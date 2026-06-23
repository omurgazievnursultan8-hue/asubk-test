// scripts/inspect/tz/probe-app-required-fields.mjs
// Opens loan-application create dialog, attempts «Далее» with empty form,
// observes required-field enforcement and address autofill behavior.
// Usage: node scripts/inspect/tz/probe-app-required-fields.mjs
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

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

await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Click «Создать»
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Создать');
  if (btn) btn.click();
});
await page.waitForTimeout(3000);
await page.screenshot({ path: '.auth/tz-req-fields-1-opened.png', fullPage: false });

// Capture initial state of fields — required/invalid indicators
const initialFields = await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field',
    'vaadin-number-field','vaadin-integer-field','jmix-value-picker',
    'vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker'];
  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })
    .map(el => {
      const r = el.getBoundingClientRect();
      const fi = el.closest('vaadin-form-item');
      const labelEl = fi ? fi.querySelector('[slot=label]') : null;
      const labelTxt = labelEl ? (labelEl.innerText || '').trim() : '';
      return {
        tag: el.tagName.toLowerCase(),
        label: labelTxt || el.getAttribute('label') || '',
        required: el.hasAttribute('required') || el.required === true,
        invalid: el.hasAttribute('invalid') || el.invalid === true,
        value: String(el.value || '').substring(0, 80),
        y: Math.round(r.top), x: Math.round(r.left),
      };
    }).sort((a, b) => a.y - b.y || a.x - b.x);
});
console.log('\n=== INITIAL FIELD STATE (on dialog open) ===');
initialFields.forEach(f => console.log(JSON.stringify(f)));

// Click «Далее» with empty form
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Далее');
  if (btn) btn.click();
});
await page.waitForTimeout(2000);
await page.screenshot({ path: '.auth/tz-req-fields-2-after-dalee.png', fullPage: false });

console.log('\nURL after Далее:', page.url());

// Capture field states after clicking Далее
const afterDaleeFields = await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field',
    'vaadin-number-field','vaadin-integer-field','jmix-value-picker',
    'vaadin-combo-box','vaadin-select','vaadin-checkbox','vaadin-date-picker'];
  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })
    .map(el => {
      const r = el.getBoundingClientRect();
      const fi = el.closest('vaadin-form-item');
      const labelEl = fi ? fi.querySelector('[slot=label]') : null;
      const labelTxt = labelEl ? (labelEl.innerText || '').trim() : '';
      // Check for error messages
      const errorMsg = el.getAttribute('error-message') || '';
      const helperText = el.getAttribute('helper-text') || '';
      return {
        tag: el.tagName.toLowerCase(),
        label: labelTxt || el.getAttribute('label') || '',
        required: el.hasAttribute('required') || el.required === true,
        invalid: el.hasAttribute('invalid') || el.invalid === true,
        errorMsg,
        helperText,
        value: String(el.value || '').substring(0, 80),
        y: Math.round(r.top), x: Math.round(r.left),
      };
    }).sort((a, b) => a.y - b.y || a.x - b.x);
});
console.log('\n=== FIELD STATE AFTER CLICKING "ДАЛЕЕ" (empty form) ===');
afterDaleeFields.forEach(f => console.log(JSON.stringify(f)));

// Check for any error messages in DOM
const errorMsgs = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('[part="error-message"], .error-message, [class*="error"]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      results.push({ tag: el.tagName, cls: (el.className||'').substring(0,60), t: (el.innerText||'').trim() });
    }
  });
  return results;
});
console.log('\n=== DOM ERROR MESSAGES ===', JSON.stringify(errorMsgs));

// Check if dialog is still visible (if Далее was blocked)
const dialogVisible = await page.evaluate(() => {
  const overlay = document.querySelector('vaadin-dialog-overlay');
  if (!overlay) return false;
  const r = overlay.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
});
console.log('\nDialog still visible after Далее:', dialogVisible);

// Also check the current buttons (to see if we advanced to a next step)
const btnsAfterDalee = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => (b.innerText||'').trim())
    .filter(t => t && t.length > 1)
);
console.log('BUTTONS AFTER ДАЛЕЕ:', JSON.stringify(btnsAfterDalee));

await ctx.close();
