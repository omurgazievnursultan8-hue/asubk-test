// scripts/inspect/tz/probe-commission-edit2.mjs
// Tries multiple approaches to open the commission edit dialog
// Usage: node scripts/inspect/tz/probe-commission-edit2.mjs
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

await page.goto(BASE + 'loan-application-commissions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Try approach 1: use page.click() at a coordinate in the data row
// First find the first data cell via evaluate to get coordinates
const firstCellCoords = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const cells = [];
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top > 350) {
        cells.push({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    }
  }
  cells.sort((a,b) => a.top - b.top || a.left - b.left);
  return cells[0] || null;
});

console.log('First data cell coords:', JSON.stringify(firstCellCoords));

if (firstCellCoords) {
  // Click using page.mouse.click with actual coordinates
  const cx = firstCellCoords.left + firstCellCoords.width / 2;
  const cy = firstCellCoords.top + firstCellCoords.height / 2;
  console.log(`Clicking at (${cx}, ${cy})`);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(1000);
}

const btnsAfterClick = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => ({ t: (b.innerText||'').trim(), disabled: b.hasAttribute('disabled') || b.disabled }))
);
console.log('BUTTONS AFTER MOUSE CLICK:', JSON.stringify(btnsAfterClick));

// Check if any row is selected
const selectedRows = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const selected = [];
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'vaadin-grid-row' || tag === 'tr') {
      if (el.hasAttribute('selected') || el.getAttribute('aria-selected') === 'true' ||
          (el.className||'').includes('selected')) {
        selected.push({ tag, cls: (el.className||'').toString().substring(0,80) });
      }
    }
  }
  return selected;
});
console.log('SELECTED ROWS:', JSON.stringify(selectedRows));

// Try double-click
if (firstCellCoords) {
  const cx = firstCellCoords.left + firstCellCoords.width / 2;
  const cy = firstCellCoords.top + firstCellCoords.height / 2;
  console.log(`Double-clicking at (${cx}, ${cy})`);
  await page.mouse.dblclick(cx, cy);
  await page.waitForTimeout(4000);
}

console.log('URL after double-click:', page.url());
await page.screenshot({ path: '.auth/tz-commission-dblclick.png', fullPage: true });

const overlayAfterDblClick = await page.evaluate(() => {
  const overlay = document.querySelector('vaadin-dialog-overlay');
  if (!overlay) return { found: false };
  const r = overlay.getBoundingClientRect();
  return {
    found: true,
    visible: r.width > 0 && r.height > 0,
    text: (overlay.innerText||'').substring(0, 600),
  };
});
console.log('OVERLAY AFTER DOUBLE-CLICK:', JSON.stringify(overlayAfterDblClick));

// If still no dialog, try approach 3: keyboard Enter on grid
await page.goto(BASE + 'loan-application-commissions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Try clicking on the grid's vaadin-grid element itself
await page.evaluate(() => {
  const grid = document.querySelector('vaadin-grid');
  if (grid) grid.focus();
});
await page.waitForTimeout(500);
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(4000);

console.log('URL after keyboard Enter:', page.url());
await page.screenshot({ path: '.auth/tz-commission-kbd.png', fullPage: true });

const overlayAfterKbd = await page.evaluate(() => {
  const overlay = document.querySelector('vaadin-dialog-overlay');
  if (!overlay) return { found: false };
  const r = overlay.getBoundingClientRect();
  return {
    found: true,
    visible: r.width > 0 && r.height > 0,
    text: (overlay.innerText||'').substring(0, 600),
  };
});
console.log('OVERLAY AFTER KEYBOARD:', JSON.stringify(overlayAfterKbd));

// Try Изменить button again
const btnsNow = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => ({ t: (b.innerText||'').trim(), disabled: b.hasAttribute('disabled') || b.disabled }))
);
console.log('BUTTONS NOW:', JSON.stringify(btnsNow));

// Try approach 4: click «Создать» to see commission create form fields
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Создать');
  if (btn) btn.click();
});
await page.waitForTimeout(4000);

console.log('URL after Создать:', page.url());
await page.screenshot({ path: '.auth/tz-commission-create.png', fullPage: true });

const createOverlay = await page.evaluate(() => {
  const overlay = document.querySelector('vaadin-dialog-overlay');
  if (!overlay) return { found: false };
  const r = overlay.getBoundingClientRect();
  return {
    found: true,
    visible: r.width > 0 && r.height > 0,
    text: (overlay.innerText||'').substring(0, 800),
  };
});
console.log('CREATE OVERLAY:', JSON.stringify(createOverlay));

// Extract all form fields from create form
const createFields = await page.evaluate(() => {
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
      const labelEl = fi ? fi.querySelector('[slot=label]') : null;
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute('label') || (labelEl ? (labelEl.innerText||'').trim() : '') || ''),
        value: String(el.value||'').substring(0, 100),
        readonly: el.hasAttribute('readonly'),
        required: el.hasAttribute('required'),
        y: Math.round(r.top), x: Math.round(r.left),
      };
    }).sort((a, b) => a.y - b.y || a.x - b.x);
});
console.log('CREATE FORM FIELDS:', JSON.stringify(createFields, null, 2));

const createTabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim())
);
console.log('CREATE TABS:', JSON.stringify(createTabs));

const createButtons = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => ({ t: (b.innerText||'').trim(), disabled: b.disabled }))
);
console.log('CREATE BUTTONS:', JSON.stringify(createButtons));

await ctx.close();
