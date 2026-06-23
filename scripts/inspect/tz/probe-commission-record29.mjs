// scripts/inspect/tz/probe-commission-record29.mjs
// Deep capture of commission record 29 — all labels, fields, sections, grid columns
// Usage: node scripts/inspect/tz/probe-commission-record29.mjs
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

await page.goto(BASE + 'loan-application-commissions/29', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
console.log('URL:', page.url());
await page.screenshot({ path: '.auth/tz-comm-record29-top.png', fullPage: false });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1000);
await page.screenshot({ path: '.auth/tz-comm-record29-bottom.png', fullPage: false });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);

// Full text dump - labels at top
const topLabels = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('label').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      results.push({ t: (el.innerText || el.textContent || '').trim(), y: Math.round(r.top), x: Math.round(r.left) });
    }
  });
  return results.sort((a,b) => a.y - b.y || a.x - b.x);
});
console.log('\n=== ALL LABELS ===');
topLabels.forEach(l => console.log(JSON.stringify(l)));

// Get all input-like fields with labels from form-items
const formItems = await page.evaluate(() => {
  const items = [];
  document.querySelectorAll('vaadin-form-item').forEach(fi => {
    const r = fi.getBoundingClientRect();
    const labelEl = fi.querySelector('[slot=label]') || fi.querySelector('label');
    const labelTxt = labelEl ? (labelEl.innerText || labelEl.textContent || '').trim() : '';
    const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field',
      'vaadin-number-field','vaadin-integer-field','jmix-value-picker',
      'jmix-multi-value-picker','vaadin-combo-box','vaadin-select',
      'vaadin-checkbox','vaadin-date-picker'];
    TAGS.forEach(tag => {
      fi.querySelectorAll(tag).forEach(el => {
        const er = el.getBoundingClientRect();
        if (er.width > 0) {
          items.push({
            label: labelTxt || el.getAttribute('label') || '',
            tag: el.tagName.toLowerCase(),
            value: String(el.value || '').substring(0, 120),
            readonly: el.hasAttribute('readonly'),
            required: el.hasAttribute('required'),
            y: Math.round(er.top), x: Math.round(er.left),
          });
        }
      });
    });
  });
  return items.sort((a, b) => a.y - b.y || a.x - b.x);
});
console.log('\n=== FORM ITEMS ===');
formItems.forEach(f => console.log(JSON.stringify(f)));

// Get ALL fields (form-items + standalone)
const allFields = await page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field',
    'vaadin-number-field','vaadin-integer-field','jmix-value-picker',
    'jmix-multi-value-picker','vaadin-combo-box','vaadin-select',
    'vaadin-checkbox','vaadin-date-picker'];
  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })
    .map(el => {
      const r = el.getBoundingClientRect();
      const fi = el.closest('vaadin-form-item');
      const labelEl = fi ? (fi.querySelector('[slot=label]') || fi.querySelector('label')) : null;
      const nearbyLabel = el.previousElementSibling;
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute('label') ||
                (labelEl ? (labelEl.innerText || '').trim() : '') ||
                (nearbyLabel ? (nearbyLabel.textContent || '').trim().substring(0,60) : '') || ''),
        value: String(el.value || '').substring(0, 120),
        readonly: el.hasAttribute('readonly'),
        required: el.hasAttribute('required'),
        y: Math.round(r.top), x: Math.round(r.left),
      };
    }).sort((a, b) => a.y - b.y || a.x - b.x);
});
console.log('\n=== ALL FIELDS ===');
allFields.forEach(f => console.log(JSON.stringify(f)));

// Section headers
const sections = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('h3,h4,h2').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) results.push({ tag: el.tagName, t: (el.innerText || '').trim(), y: Math.round(r.top) });
  });
  return results.sort((a, b) => a.y - b.y);
});
console.log('\n=== SECTIONS ===');
sections.forEach(s => console.log(JSON.stringify(s)));

// Buttons
const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => ({ t: (b.innerText || '').trim(), disabled: b.disabled }))
);
console.log('\n=== BUTTONS ===', JSON.stringify(buttons));

// Grid cells (members table)
const gridCells = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const cells = [];
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (r.width > 0 && r.height > 0 && t) {
        cells.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
      }
    }
  }
  return cells.sort((a, b) => a.y - b.y || a.x - b.x);
});
console.log('\n=== GRID CELLS ===');
gridCells.forEach(c => console.log(JSON.stringify(c)));

// Get vote progress section text
const voteText = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('p, span, div').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.top > 900 && r.top < 1600) {
      const t = (el.innerText || '').trim();
      if (t && t.length > 0 && t.length < 200 && !t.includes('\n')) {
        results.push({ tag: el.tagName, t, y: Math.round(r.top), x: Math.round(r.left) });
      }
    }
  });
  return results.sort((a, b) => a.y - b.y || a.x - b.x).filter((v, i, arr) =>
    !arr.slice(0, i).find(p => p.t === v.t && Math.abs(p.y - v.y) < 5)
  );
});
console.log('\n=== VOTE SECTION TEXT (y>900) ===');
voteText.forEach(t => console.log(JSON.stringify(t)));

await ctx.close();
