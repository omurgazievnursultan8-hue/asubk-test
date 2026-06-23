// scripts/inspect/tz/probe-commission-edit.mjs
// Attempts to open commission edit dialog via «Изменить» button
// Usage: node scripts/inspect/tz/probe-commission-edit.mjs
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
await page.waitForTimeout(2500);

// Dump all visible buttons before selection
const btnsBefore = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => ({ t: (b.innerText||'').trim(), disabled: b.hasAttribute('disabled') || b.disabled }))
);
console.log('BUTTONS BEFORE SELECTION:', JSON.stringify(btnsBefore));

// Click on the first data row (not header)
await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const cells = [];
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top > 350) cells.push({ el, top: r.top, left: r.left });
    }
  }
  cells.sort((a, b) => a.top - b.top || a.left - b.left);
  // Click on the first cell in first data row (index 0 after header)
  if (cells.length > 0) {
    cells[0].el.click();
    console.log('Clicked cell at top:', cells[0].top);
  }
});
await page.waitForTimeout(1000);

const btnsAfter = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => ({ t: (b.innerText||'').trim(), disabled: b.hasAttribute('disabled') || b.disabled }))
);
console.log('BUTTONS AFTER SELECTION:', JSON.stringify(btnsAfter));

// Click «Изменить»
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Изменить');
  if (btn && !btn.disabled) {
    btn.click();
    return 'clicked';
  }
  return btn ? 'disabled' : 'not found';
});
console.log('Изменить click result:', clicked);

await page.waitForTimeout(4000);
console.log('URL after Изменить:', page.url());
await page.screenshot({ path: '.auth/tz-commission-edit-attempt.png', fullPage: true });

// Try to find a dialog overlay
const overlayInfo = await page.evaluate(() => {
  const overlay = document.querySelector('vaadin-dialog-overlay');
  if (!overlay) return { found: false };
  const r = overlay.getBoundingClientRect();
  return {
    found: true,
    visible: r.width > 0 && r.height > 0,
    text: (overlay.innerText||'').substring(0, 600),
  };
});
console.log('DIALOG OVERLAY:', JSON.stringify(overlayInfo));

// Extract all visible form fields (full DOM walk for shadow roots)
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
console.log('ALL VISIBLE FIELDS:', JSON.stringify(allFields, null, 2));

// Try tabs
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim())
);
console.log('TABS:', JSON.stringify(tabs));

// Extract grid cells (members table)
const extractCells = async () => page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const cells = [];
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      const t = (el.textContent||'').trim().replace(/\s+/g,' ');
      if (r.width > 0 && r.top > 300 && t) cells.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
    }
  }
  return cells.sort((a,b)=>a.y-b.y||a.x-b.x).slice(0,50);
});

const cells = await extractCells();
console.log('GRID CELLS:', JSON.stringify(cells));

// Walk tabs
for (let i = 0; i < tabs.length; i++) {
  await page.evaluate((idx) => {
    const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
    allTabs[idx] && allTabs[idx].click();
  }, i);
  await page.waitForTimeout(2000);

  const fields = await page.evaluate(() => {
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
          y: Math.round(r.top), x: Math.round(r.left),
        };
      }).sort((a, b) => a.y - b.y || a.x - b.x);
  });

  const tabCells = await extractCells();
  await page.screenshot({ path: `.auth/tz-comm-edit-tab${i+1}.png`, fullPage: true });

  console.log(`\n--- EDIT TAB ${i+1}: ${tabs[i]} ---`);
  console.log('fields:', JSON.stringify(fields));
  console.log('cells:', JSON.stringify(tabCells.slice(0,30)));
}

await ctx.close();
