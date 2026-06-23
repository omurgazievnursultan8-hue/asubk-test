// scripts/inspect/tz/probe-app-fields.mjs
// Probes loan-applications/28 in detail: captures field labels from form-items,
// reads schedule (График) tab data, reads commission tabs, status values.
// Usage: node scripts/inspect/tz/probe-app-fields.mjs
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();

// Login
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

// Navigate to loan-applications and find any application detail
await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Select first row and click Изменить (proved to work: opens /loan-applications/28)
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
      if (r.width > 0 && r.height > 0 && r.top > 100) cells.push({ el, top: r.top, left: r.left });
    }
  }
  cells.sort((a, b) => a.top - b.top || a.left - b.left);
  if (cells.length > 8) cells[8].el.click();
});
await page.waitForTimeout(800);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Изменить');
  if (btn) btn.click();
});
await page.waitForTimeout(4000);
console.log('On page:', page.url());

// === TAB 1: Общая информация ===
// Extract form-items with their labels and field values
const tab1Data = await page.evaluate(() => {
  // Walk ALL form items in the DOM to get label+field pairs
  const items = [];

  // First try: vaadin-form-item with slot=label
  document.querySelectorAll('vaadin-form-item').forEach(fi => {
    const r = fi.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const labelEl = fi.querySelector('[slot=label]');
    const labelTxt = labelEl ? (labelEl.innerText || '').trim() : '';

    // Get child field elements
    const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field',
      'vaadin-number-field','vaadin-integer-field','jmix-value-picker',
      'vaadin-select','vaadin-checkbox','vaadin-date-picker','vaadin-combo-box'];
    TAGS.forEach(tag => {
      fi.querySelectorAll(tag).forEach(el => {
        if (el.getBoundingClientRect().width > 0) {
          items.push({
            label: labelTxt || el.getAttribute('label') || '',
            tag: el.tagName.toLowerCase(),
            value: el.value !== undefined ? String(el.value).substring(0,100) : '',
            readonly: el.hasAttribute('readonly') || el.readonly === true,
            required: el.hasAttribute('required') || el.required === true,
            y: Math.round(fi.getBoundingClientRect().top),
            x: Math.round(fi.getBoundingClientRect().left),
          });
        }
      });
    });
  });

  return items.sort((a,b) => a.y - b.y || a.x - b.x);
});

console.log('\n=== TAB 1 Общая информация form-items ===');
console.log(JSON.stringify(tab1Data, null, 2));

// Also get all text nodes near bold labels to find section headers
const sectionHeaders = await page.evaluate(() => {
  const headers = [];
  document.querySelectorAll('h3,h4,[class*="section"],[class*="header"]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.top > 300) {
      headers.push({ tag: el.tagName.toLowerCase(), cls: (el.className||'').toString().substring(0,60), t: (el.innerText||'').trim().substring(0,100), y: Math.round(r.top) });
    }
  });
  return headers.sort((a,b) => a.y - b.y).slice(0, 30);
});
console.log('\n=== SECTION HEADERS ===');
console.log(JSON.stringify(sectionHeaders));

// === STATUS CHECK ===
// Read stepper steps
const stepperSteps = await page.evaluate(() => {
  const steps = [];
  document.querySelectorAll('.loan-status-step, [class*="loan-status"], [class*="step-"]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) {
      steps.push({ cls: (el.className||'').toString(), t: (el.innerText||'').trim().substring(0,100), y: Math.round(r.top) });
    }
  });
  return steps.sort((a,b) => a.y - b.y);
});
console.log('\n=== STATUS STEPPER STEPS ===');
console.log(JSON.stringify(stepperSteps));

// === TAB 2: График ===
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  tabs[1] && tabs[1].click(); // График is tab index 1
});
await page.waitForTimeout(2000);
await page.screenshot({ path: '.auth/tz-la-schedule.png', fullPage: true });

const scheduleData = await page.evaluate(() => {
  // Read grid columns and first few rows
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }

  const cols = [];
  const cells = [];

  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'vaadin-grid-column' || tag === 'vaadin-grid-sort-column') {
      const h = el.getAttribute('header') || el.getAttribute('path') || '';
      if (h) cols.push(h);
    }
    if (tag === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      const t = (el.textContent || '').trim().replace(/\s+/g,' ');
      if (r.width > 0 && r.top > 300 && t) cells.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
    }
  }

  return { cols, cells: cells.sort((a,b) => a.y - b.y || a.x - b.x).slice(0, 60) };
});
console.log('\n=== TAB 2 ГРАФИК ===');
console.log('Cols:', JSON.stringify(scheduleData.cols));
console.log('Cells (first 40):', JSON.stringify(scheduleData.cells.slice(0,40)));

// === TAB 7: Кредитная комиссия ===
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  tabs[6] && tabs[6].click(); // Кредитная комиссия is tab index 6
});
await page.waitForTimeout(2000);
await page.screenshot({ path: '.auth/tz-la-commission.png', fullPage: true });

const commissionTab = await page.evaluate(() => {
  const cells = [];
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      const t = (el.textContent||'').trim().replace(/\s+/g,' ');
      if (r.width > 0 && r.top > 300 && t) cells.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
    }
  }

  const buttons = [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => (b.innerText||'').trim())
    .filter(t => t && t.length < 80 && t.length > 1);

  return { cells: cells.sort((a,b)=>a.y-b.y||a.x-b.x).slice(0,40), buttons };
});
console.log('\n=== TAB 7 Кредитная комиссия ===');
console.log('Cells:', JSON.stringify(commissionTab.cells));
console.log('Buttons:', JSON.stringify(commissionTab.buttons));

// === TAB 8: Залоговая комиссия ===
await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  tabs[7] && tabs[7].click();
});
await page.waitForTimeout(2000);

const zalCommissionTab = await page.evaluate(() => {
  const cells = [];
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      const t = (el.textContent||'').trim().replace(/\s+/g,' ');
      if (r.width > 0 && r.top > 300 && t) cells.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
    }
  }
  const buttons = [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => (b.innerText||'').trim())
    .filter(t => t && t.length < 80 && t.length > 1);
  return { cells: cells.sort((a,b)=>a.y-b.y||a.x-b.x).slice(0,30), buttons };
});
console.log('\n=== TAB 8 Залоговая комиссия ===');
console.log('Cells:', JSON.stringify(zalCommissionTab.cells));
console.log('Buttons:', JSON.stringify(zalCommissionTab.buttons));

// === Now read ALL status values from loan-applications list ===
await page.goto(BASE + 'loan-applications', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Clear the filter to see all statuses
const filterCleared = await page.evaluate(() => {
  // Find and click remove buttons on filter chips
  const removed = [];
  document.querySelectorAll('vaadin-button').forEach(b => {
    const t = (b.innerText || '').trim();
    if (/^[×x✕]$/.test(t) || t === 'Remove') {
      b.click();
      removed.push(t);
    }
  });
  return removed;
});
console.log('\n=== FILTER REMOVE ATTEMPTS ===', JSON.stringify(filterCleared));
await page.waitForTimeout(2000);

// Read all status values
const allStatuses = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const cellTexts = [];
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      const t = (el.textContent||'').trim().replace(/\s+/g,' ');
      if (r.width > 0 && t) cellTexts.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
    }
  }
  return cellTexts.sort((a,b)=>a.y-b.y||a.x-b.x);
});
console.log('\n=== ALL LIST CELLS (with statuses) ===');
console.log(JSON.stringify(allStatuses));
await page.screenshot({ path: '.auth/tz-la-list-all.png', fullPage: true });

// === Inspect commission detail ===
await page.goto(BASE + 'loan-application-commissions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Select first row and click Изменить
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
      if (r.width > 0 && r.height > 0 && r.top > 100) cells.push({ el, top: r.top, left: r.left });
    }
  }
  cells.sort((a,b) => a.top - b.top || a.left - b.left);
  if (cells.length > 8) cells[8].el.click();
});
await page.waitForTimeout(800);

// Use Изменить for commission
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Изменить');
  if (btn) btn.click();
});
await page.waitForTimeout(4000);
console.log('\n=== COMMISSION DETAIL URL ===', page.url());
await page.screenshot({ path: '.auth/tz-commission-detail.png', fullPage: true });

const commissionDetail = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }

  const items = [];
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'vaadin-form-item') {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.top < 100) continue;
      const labelEl = el.querySelector('[slot=label]');
      const labelTxt = labelEl ? (labelEl.innerText||'').trim() : '';
      const FTAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field',
        'vaadin-number-field','vaadin-integer-field','jmix-value-picker',
        'vaadin-select','vaadin-checkbox','vaadin-date-picker','vaadin-combo-box'];
      FTAGS.forEach(ft => {
        el.querySelectorAll(ft).forEach(f => {
          if (f.getBoundingClientRect().width > 0) {
            items.push({ label: labelTxt || f.getAttribute('label') || '', tag: f.tagName.toLowerCase(), value: String(f.value||'').substring(0,80), readonly: f.hasAttribute('readonly'), y: Math.round(r.top), x: Math.round(r.left) });
          }
        });
      });
    }
  }

  // Also get tabs
  const tabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0).map(t => t.innerText.trim());

  const buttons = [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => (b.innerText||'').trim())
    .filter(t => t && t.length > 1 && t.length < 60);

  // Cells
  const cells = [];
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      const t = (el.textContent||'').trim().replace(/\s+/g,' ');
      if (r.width > 0 && r.top > 300 && t) cells.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
    }
  }

  return { items: items.sort((a,b)=>a.y-b.y||a.x-b.x), tabs, buttons, cells: cells.sort((a,b)=>a.y-b.y||a.x-b.x).slice(0,50) };
});
console.log('\n=== COMMISSION DETAIL ===');
console.log('tabs:', JSON.stringify(commissionDetail.tabs));
console.log('items:', JSON.stringify(commissionDetail.items));
console.log('buttons:', JSON.stringify(commissionDetail.buttons));
console.log('cells:', JSON.stringify(commissionDetail.cells));

await ctx.close();
