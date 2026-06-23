// scripts/inspect/tz/dump-form-aria.mjs
// Uses Playwright's built-in locators (which pierce shadow DOM) to find form fields.
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

// Navigate to create form
await page.goto(BASE + 'gov-decisions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Use Playwright's CSS selector with shadow piercing
const fieldTags = [
  'vaadin-text-field', 'vaadin-combo-box', 'vaadin-date-picker',
  'vaadin-number-field', 'vaadin-text-area', 'vaadin-select',
  'vaadin-checkbox', 'vaadin-radio-button', 'vaadin-email-field',
  'vaadin-integer-field', 'jmix-entity-picker', 'jmix-value-picker',
  'jmix-entity-combo-box',
];

const results = { url: page.url(), fields: [], tabs: [], buttons: [] };

for (const tag of fieldTags) {
  // Playwright's locator() pierces shadow DOM
  const els = page.locator(tag);
  const count = await els.count();
  for (let i = 0; i < count; i++) {
    const el = els.nth(i);
    try {
      const label = await el.getAttribute('label');
      const required = await el.getAttribute('required');
      const readonly = await el.getAttribute('readonly');
      const disabled = await el.getAttribute('disabled');
      const value = await el.getAttribute('value');
      results.fields.push({ tag, label, required: required !== null, readonly: readonly !== null, disabled: disabled !== null, value });
    } catch (e) {
      results.fields.push({ tag, error: e.message });
    }
  }
}

// Tabs
const tabs = page.locator('vaadin-tab');
const tabCount = await tabs.count();
for (let i = 0; i < tabCount; i++) {
  try {
    const text = await tabs.nth(i).textContent();
    results.tabs.push(text?.trim());
  } catch {}
}

// Buttons in the form area (not nav)
const buttons = page.locator('vaadin-button');
const btnCount = await buttons.count();
for (let i = 0; i < btnCount; i++) {
  try {
    const text = await buttons.nth(i).textContent();
    const t = text?.trim().replace(/\s+/g, ' ');
    if (t && t.length < 60) results.buttons.push(t);
  } catch {}
}

console.log(JSON.stringify(results, null, 2));
await ctx.close();
