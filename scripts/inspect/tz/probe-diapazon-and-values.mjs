// scripts/inspect/tz/probe-diapazon-and-values.mjs
// 1. Open the create wizard, go to tab 2, select «Диапазон» for сумма,
//    observe which fields appear. Then do the same for срок (still tab 2).
// 2. Open an existing program (first «Изменить» in list) and read actual
//    сумма / срок / ставка values from tabs 2 and 3.
// Usage: node scripts/inspect/tz/probe-diapazon-and-values.mjs
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

// ─── Helper: capture visible field-like elements ──────────────────────────────
const extractFields = () => page.evaluate(() => {
  const TAGS = [
    'vaadin-text-field', 'vaadin-text-area', 'vaadin-big-decimal-field',
    'vaadin-number-field', 'vaadin-integer-field', 'jmix-value-picker',
    'jmix-multi-value-picker', 'vaadin-combo-box', 'vaadin-select',
    'vaadin-checkbox', 'vaadin-date-picker', 'vaadin-multi-select-combo-box',
  ];
  const labelOf = (el) => {
    let l = el.label || el.getAttribute('label');
    if (!l) {
      const id = el.getAttribute('aria-labelledby');
      if (id) { const t = id.split(' ').map(i => document.getElementById(i)?.innerText || '').join(' ').trim(); if (t) l = t; }
    }
    if (!l) { const p = el.closest('vaadin-form-item'); if (p) { const lab = p.querySelector('[slot=label]'); if (lab) l = lab.innerText; } }
    if (!l && el.shadowRoot) { const sr = el.shadowRoot.querySelector('[part=label]'); if (sr) l = sr.innerText; }
    return (l || '').replace(/\s+/g, ' ').trim() || null;
  };
  const valueOf = (el) => {
    if (el.value !== undefined && el.value !== null && el.value !== '') return String(el.value);
    if (el.shadowRoot) {
      const inp = el.shadowRoot.querySelector('input');
      if (inp && inp.value) return inp.value;
    }
    return null;
  };
  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => e.getBoundingClientRect().width > 0)
    .map(el => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        label: labelOf(el),
        value: valueOf(el),
        required: el.required === true,
        readonly: el.readonly === true,
        y: Math.round(r.top),
        x: Math.round(r.left),
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
});

// ─── PART 1: New program wizard, tab 2, select «Диапазон» for сумма ──────────
console.log('\n=== PART 1: Диапазон rendering on CREATE wizard ===');
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Click «Создать»
await page.evaluate(() => {
  const b = [...document.querySelectorAll('vaadin-button')].find(b => /Создать/i.test(b.innerText));
  b && b.click();
});
await page.waitForTimeout(3000);

// Click tab 2 (index 1)
await page.evaluate(() => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  allTabs[1] && allTabs[1].click();
});
await page.waitForTimeout(2000);

const tab2Before = await extractFields();
console.log('Tab 2 fields BEFORE selecting Диапазон (сумма):');
console.log(JSON.stringify(tab2Before, null, 2));
await page.screenshot({ path: '.auth/probe-tab2-before.png', fullPage: true });

// Find «Тип суммы кредита» select and set to «Диапазон»
const summaSelectResult = await page.evaluate(async () => {
  // Find all vaadin-select on the page
  const selects = [...document.querySelectorAll('vaadin-select')].filter(e => e.getBoundingClientRect().width > 0);
  const labelOf = (el) => {
    let l = el.label || el.getAttribute('label');
    if (!l) { const p = el.closest('vaadin-form-item'); if (p) { const lab = p.querySelector('[slot=label]'); if (lab) l = lab.innerText; } }
    return (l || '').trim();
  };
  const results = selects.map(s => ({ label: labelOf(s), value: s.value, y: Math.round(s.getBoundingClientRect().top) }));
  return results;
});
console.log('Selects found on tab 2:', JSON.stringify(summaSelectResult));

// Click first vaadin-select (Тип суммы кредита) to open dropdown, then pick Диапазон
const clickedDiapazon = await page.evaluate(async () => {
  const selects = [...document.querySelectorAll('vaadin-select')].filter(e => e.getBoundingClientRect().width > 0);
  if (!selects[0]) return { ok: false, reason: 'no select found' };
  // Set value directly
  selects[0].value = 'RANGE';
  selects[0].dispatchEvent(new Event('change', { bubbles: true }));
  selects[0].dispatchEvent(new CustomEvent('value-changed', { bubbles: true, detail: { value: 'RANGE' } }));
  return { ok: true, newValue: selects[0].value, label: selects[0].label || selects[0].getAttribute('label') };
});
console.log('After setting value=RANGE on select[0]:', JSON.stringify(clickedDiapazon));

// Try opening the overlay via click instead
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')].filter(e => e.getBoundingClientRect().width > 0);
  if (selects[0]) selects[0].click();
});
await page.waitForTimeout(1500);

// Check overlay items
const overlayItems = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')];
  return items.filter(i => i.getBoundingClientRect().height > 0).map(i => ({ text: i.innerText.trim(), value: i.value }));
});
console.log('Dropdown items for select[0]:', JSON.stringify(overlayItems));

// Click «Диапазон» if it exists in overlay
const clickedItem = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')];
  const diapazonItem = items.find(i => /Диапазон/i.test(i.innerText) && i.getBoundingClientRect().height > 0);
  if (diapazonItem) { diapazonItem.click(); return { clicked: true, text: diapazonItem.innerText.trim() }; }
  return { clicked: false, available: items.map(i => i.innerText.trim()) };
});
console.log('Clicked Диапазон item:', JSON.stringify(clickedItem));
await page.waitForTimeout(2000);

const tab2AfterSummaDiapazon = await extractFields();
console.log('Tab 2 fields AFTER selecting Диапазон for сумма:');
console.log(JSON.stringify(tab2AfterSummaDiapazon, null, 2));
await page.screenshot({ path: '.auth/probe-tab2-summa-diapazon.png', fullPage: true });

// Now try selecting Диапазон for срок (second select on tab 2)
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')].filter(e => e.getBoundingClientRect().width > 0);
  if (selects[1]) selects[1].click();
});
await page.waitForTimeout(1500);

const overlayItemsSrok = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')];
  return items.filter(i => i.getBoundingClientRect().height > 0).map(i => ({ text: i.innerText.trim(), value: i.value }));
});
console.log('Dropdown items for select[1] (Срок):', JSON.stringify(overlayItemsSrok));

const clickedSrokDiapazon = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')];
  const diapazonItem = items.find(i => /Диапазон/i.test(i.innerText) && i.getBoundingClientRect().height > 0);
  if (diapazonItem) { diapazonItem.click(); return { clicked: true, text: diapazonItem.innerText.trim() }; }
  return { clicked: false };
});
console.log('Clicked Диапазон for срок:', JSON.stringify(clickedSrokDiapazon));
await page.waitForTimeout(2000);

const tab2AfterSrokDiapazon = await extractFields();
console.log('Tab 2 fields AFTER selecting Диапазон for BOTH сумма and срок:');
console.log(JSON.stringify(tab2AfterSrokDiapazon, null, 2));
await page.screenshot({ path: '.auth/probe-tab2-both-diapazon.png', fullPage: true });

// ─── PART 2: Open existing program and read values ────────────────────────────
console.log('\n=== PART 2: Existing program values ===');
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Read the list to get program names
const listRows = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('vaadin-grid-cell-content')];
  return rows.filter(r => r.getBoundingClientRect().width > 0).map(r => r.innerText.trim()).filter(t => t && t.length > 2).slice(0, 50);
});
console.log('List cell contents (first 50):', JSON.stringify(listRows));

// Click «Изменить» after selecting first row — first click on a data row
await page.evaluate(() => {
  // Try to click first data row
  const gridRows = [...document.querySelectorAll('vaadin-grid-row, tr[part*="row"]')];
  const dataRows = gridRows.filter(r => r.getBoundingClientRect().width > 0);
  if (dataRows[0]) dataRows[0].click();
});
await page.waitForTimeout(1000);

// Click «Изменить»
await page.evaluate(() => {
  const b = [...document.querySelectorAll('vaadin-button')].find(b => /Изменить/i.test(b.innerText));
  b && b.click();
});
await page.waitForTimeout(4000);

const currentUrl = page.url();
console.log('Current URL after Изменить:', currentUrl);

// Read tab 1 fields first (to get program name)
const tab1Fields = await extractFields();
console.log('Tab 1 fields (program name etc):');
tab1Fields.filter(f => f.value).forEach(f => console.log(`  ${f.label}: ${f.value}`));

// Go to tab 2
await page.evaluate(() => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  allTabs[1] && allTabs[1].click();
});
await page.waitForTimeout(2000);

const editTab2Fields = await extractFields();
console.log('Existing program TAB 2 fields (сумма/срок):');
console.log(JSON.stringify(editTab2Fields, null, 2));
await page.screenshot({ path: '.auth/probe-edit-tab2.png', fullPage: true });

// Activate Диапазон in the edit form to see what shows up
const editSelects = await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')].filter(e => e.getBoundingClientRect().width > 0);
  return selects.map(s => {
    const labelOf = (el) => {
      let l = el.label || el.getAttribute('label');
      if (!l) { const p = el.closest('vaadin-form-item'); if (p) { const lab = p.querySelector('[slot=label]'); if (lab) l = lab.innerText; } }
      return (l || '').trim();
    };
    return { label: labelOf(s), value: s.value, items: s.items ? JSON.stringify(s.items) : null };
  });
});
console.log('Tab 2 selects in edit mode:', JSON.stringify(editSelects));

// Open select[0] overlay to see available options
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')].filter(e => e.getBoundingClientRect().width > 0);
  if (selects[0]) selects[0].click();
});
await page.waitForTimeout(1500);

const editTab2SelectOptions = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')];
  return items.filter(i => i.getBoundingClientRect().height > 0).map(i => ({ text: i.innerText.trim(), value: i.value }));
});
console.log('Edit tab2 select[0] options:', JSON.stringify(editTab2SelectOptions));

// Select Диапазон for сумма
const editDiapazonClick = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')];
  const d = items.find(i => /Диапазон/i.test(i.innerText) && i.getBoundingClientRect().height > 0);
  if (d) { d.click(); return { clicked: true }; }
  return { clicked: false };
});
console.log('Edit: click Диапазон for сумма:', JSON.stringify(editDiapazonClick));
await page.waitForTimeout(2000);

const editTab2AfterDiapazon = await extractFields();
console.log('Edit TAB 2 fields AFTER selecting Диапазон for сумма:');
console.log(JSON.stringify(editTab2AfterDiapazon, null, 2));
await page.screenshot({ path: '.auth/probe-edit-tab2-diapazon.png', fullPage: true });

// Go to tab 3 (ставки)
await page.evaluate(() => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  allTabs[2] && allTabs[2].click();
});
await page.waitForTimeout(2000);

const editTab3Fields = await extractFields();
console.log('Existing program TAB 3 fields (ставки):');
console.log(JSON.stringify(editTab3Fields, null, 2));
await page.screenshot({ path: '.auth/probe-edit-tab3.png', fullPage: true });

// Activate Диапазон for ставка
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')].filter(e => e.getBoundingClientRect().width > 0);
  if (selects[0]) selects[0].click();
});
await page.waitForTimeout(1500);
const editTab3SelectOptions = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')];
  return items.filter(i => i.getBoundingClientRect().height > 0).map(i => ({ text: i.innerText.trim(), value: i.value }));
});
console.log('Tab3 select options:', JSON.stringify(editTab3SelectOptions));

const editTab3DiapazonClick = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')];
  const d = items.find(i => /Диапазон/i.test(i.innerText) && i.getBoundingClientRect().height > 0);
  if (d) { d.click(); return { clicked: true }; }
  return { clicked: false };
});
console.log('Edit tab3: click Диапазон for ставка:', JSON.stringify(editTab3DiapazonClick));
await page.waitForTimeout(2000);

const editTab3AfterDiapazon = await extractFields();
console.log('Edit TAB 3 fields AFTER selecting Диапазон for ставка:');
console.log(JSON.stringify(editTab3AfterDiapazon, null, 2));
await page.screenshot({ path: '.auth/probe-edit-tab3-diapazon.png', fullPage: true });

// Also try ALL programs in list to find any with filled values
console.log('\n=== PART 3: All programs — check for filled values ===');
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Get grid data
const allGridData = await page.evaluate(() => {
  function* walkAll(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      yield node;
      if (node.shadowRoot) yield* walkAll(node.shadowRoot);
      node = walker.nextNode();
    }
  }
  const cells = [];
  for (const el of walkAll(document)) {
    if (el.tagName && el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        cells.push({ text: (el.innerText || '').trim(), y: Math.round(r.top), x: Math.round(r.left) });
      }
    }
  }
  return cells.sort((a, b) => a.y - b.y || a.x - b.x);
});
console.log('All grid cells:', JSON.stringify(allGridData));

await ctx.close();
console.log('\nDONE');
