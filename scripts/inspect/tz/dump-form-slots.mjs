// scripts/inspect/tz/dump-form-slots.mjs
// Reads label text from label slot content inside Vaadin shadow DOM.
// Vaadin puts label text in the "label" slot, accessible via slot[name="label"].
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

  function getSlotText(el, slotName) {
    // Get text from slotted content in light DOM
    const slotted = el.querySelector(`[slot="${slotName}"]`);
    if (slotted) return slotted.textContent?.trim() || '';
    // Also look in shadow root slots
    if (el.shadowRoot) {
      const slot = el.shadowRoot.querySelector(`slot[name="${slotName}"]`);
      if (slot) {
        const assigned = slot.assignedNodes({ flatten: true });
        return assigned.map(n => n.textContent || '').join('').trim();
      }
    }
    return '';
  }

  function getAllText(el) {
    // Get all visible text in light DOM children
    const texts = [];
    for (const child of el.childNodes) {
      const t = child.textContent?.trim();
      if (t) texts.push(t);
    }
    return texts.join(' ').trim();
  }

  // Also try: Vaadin stores label in the component's internal "label" property
  function getInternalLabel(el) {
    // Property (not attribute) access
    if (typeof el.label === 'string' && el.label) return el.label;
    return '';
  }

  function getRequiredFromIndicator(el) {
    if (el.hasAttribute('required')) return true;
    if (el.required === true) return true;
    return false;
  }

  function* walkAll(root) {
    const children = root.children || [];
    for (const child of children) {
      yield child;
      if (child.shadowRoot) yield* walkAll(child.shadowRoot);
      yield* walkAll(child);
    }
  }

  const fields = [];
  const seen = new WeakSet();

  for (const el of walkAll(document)) {
    if (seen.has(el)) continue;
    seen.add(el);
    const tag = el.tagName?.toLowerCase();
    if (!tag || !FIELD_TAGS.includes(tag)) continue;

    const labelAttr = el.getAttribute('label') || '';
    const labelProp = getInternalLabel(el);
    const labelSlot = getSlotText(el, 'label');
    const lightDomText = getAllText(el);
    const ro = el.hasAttribute('readonly') || el.readonly === true;
    const req = getRequiredFromIndicator(el);
    const value = el.value !== undefined ? String(el.value) : (el.getAttribute('value') || '');

    fields.push({
      tag,
      labelAttr,
      labelProp,
      labelSlot,
      lightDomText: lightDomText.slice(0, 100),
      required: req,
      readonly: ro,
      value: value.slice(0, 50),
    });
  }

  return { url: location.href, fields };
});

console.log(JSON.stringify(result, null, 2));
await ctx.close();
