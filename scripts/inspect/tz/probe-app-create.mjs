// scripts/inspect/tz/probe-app-create.mjs
// Opens the «Создать» dialog on loan-applications and captures create form fields
// Usage: node scripts/inspect/tz/probe-app-create.mjs
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

// Click Создать
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Создать');
  if (btn) btn.click();
});
await page.waitForTimeout(3000);
await page.screenshot({ path: '.auth/tz-la-create.png', fullPage: true });
console.log('URL after create:', page.url());

// Get form fields from the modal/page
const fields = await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field',
    'vaadin-number-field','vaadin-integer-field','jmix-value-picker',
    'jmix-multi-value-picker','vaadin-combo-box','vaadin-select',
    'vaadin-checkbox','vaadin-date-picker'];

  const items = [];
  // Try form-items first
  document.querySelectorAll('vaadin-form-item').forEach(fi => {
    const r = fi.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const labelEl = fi.querySelector('[slot=label]');
    const labelTxt = labelEl ? (labelEl.innerText||'').trim() : '';
    TAGS.forEach(tag => {
      fi.querySelectorAll(tag).forEach(el => {
        if (el.getBoundingClientRect().width > 0) {
          items.push({
            label: labelTxt || el.getAttribute('label') || '',
            tag: el.tagName.toLowerCase(),
            required: el.hasAttribute('required') || el.required === true,
            readonly: el.hasAttribute('readonly') || el.readonly === true,
            value: String(el.value||'').substring(0,80),
            y: Math.round(r.top), x: Math.round(r.left),
          });
        }
      });
    });
  });

  // Also look for standalone fields not in form-items
  if (items.length === 0) {
    document.querySelectorAll(TAGS.join(',')).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const lbl = el.getAttribute('label') || '';
      items.push({
        label: lbl,
        tag: el.tagName.toLowerCase(),
        required: el.hasAttribute('required') || el.required === true,
        readonly: el.hasAttribute('readonly') || el.readonly === true,
        value: String(el.value||'').substring(0,80),
        y: Math.round(r.top), x: Math.round(r.left),
      });
    });
  }

  return items.sort((a,b) => a.y - b.y || a.x - b.x);
});
console.log('CREATE FORM FIELDS:', JSON.stringify(fields, null, 2));

// Section headers in dialog
const sections = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('h3,h4,[class*="dialog"] h2, vaadin-dialog-container h2, vaadin-dialog-container h3').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) out.push({ tag: el.tagName.toLowerCase(), t: (el.innerText||'').trim(), y: Math.round(r.top) });
  });
  return out.sort((a,b) => a.y - b.y);
});
console.log('DIALOG SECTIONS:', JSON.stringify(sections));

// Dialog title and buttons
const dialogInfo = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => (b.innerText||'').trim())
    .filter(t => t && t.length > 1 && t.length < 60);

  // Dialog overlay
  const overlay = document.querySelector('vaadin-dialog-overlay') || document.querySelector('[part="overlay"]');
  const overlayText = overlay ? (overlay.innerText||'').substring(0,500) : '';

  return { buttons, overlayText };
});
console.log('DIALOG BUTTONS:', JSON.stringify(dialogInfo.buttons));
console.log('DIALOG TEXT (first 500):', dialogInfo.overlayText);

await ctx.close();
