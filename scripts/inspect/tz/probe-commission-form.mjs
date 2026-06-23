// scripts/inspect/tz/probe-commission-form.mjs
// Opens /loan-application-commissions/new and deeply captures all form fields + labels
// Usage: node scripts/inspect/tz/probe-commission-form.mjs
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

// Navigate directly to the new commission form
await page.goto(BASE + 'loan-application-commissions/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

console.log('URL:', page.url());
await page.screenshot({ path: '.auth/tz-commission-form-full.png', fullPage: true });

// Scroll to bottom to capture all content
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1000);
await page.screenshot({ path: '.auth/tz-commission-form-bottom.png', fullPage: true });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);

// Extract all form-items with labels
const formItems = await page.evaluate(() => {
  const items = [];
  document.querySelectorAll('vaadin-form-item').forEach(fi => {
    const r = fi.getBoundingClientRect();
    const labelEl = fi.querySelector('[slot=label]');
    const labelTxt = labelEl ? (labelEl.innerText || labelEl.textContent || '').trim() : '';
    const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field',
      'vaadin-number-field','vaadin-integer-field','jmix-value-picker',
      'jmix-multi-value-picker','vaadin-combo-box','vaadin-select',
      'vaadin-checkbox','vaadin-date-picker'];
    TAGS.forEach(tag => {
      fi.querySelectorAll(tag).forEach(el => {
        const er = el.getBoundingClientRect();
        items.push({
          label: labelTxt || el.getAttribute('label') || '',
          tag: el.tagName.toLowerCase(),
          value: String(el.value || '').substring(0, 100),
          readonly: el.hasAttribute('readonly'),
          required: el.hasAttribute('required'),
          y: Math.round(r.top), x: Math.round(r.left),
        });
      });
    });
  });
  return items.sort((a, b) => a.y - b.y || a.x - b.x);
});
console.log('\n=== FORM ITEMS ===');
formItems.forEach(f => console.log(JSON.stringify(f)));

// Try to get labels via aria or column headers (the header row of the form)
const allText = await page.evaluate(() => {
  // Collect all visible text elements that look like labels
  const results = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    const tag = node.tagName.toLowerCase();
    const r = node.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      if (tag === 'label' || tag === 'span' || tag === 'div' || tag === 'h3' || tag === 'h4' || tag === 'p') {
        const t = (node.innerText || node.textContent || '').trim();
        if (t && t.length > 1 && t.length < 100 && !t.includes('\n')) {
          results.push({ tag, t, y: Math.round(r.top), x: Math.round(r.left) });
        }
      }
    }
    node = walker.nextNode();
  }
  return results.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 80);
});
console.log('\n=== ALL TEXT ELEMENTS ===');
allText.forEach(t => console.log(JSON.stringify(t)));

// Get all buttons on the form
const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => ({ t: (b.innerText || '').trim(), disabled: b.hasAttribute('disabled') || b.disabled }))
);
console.log('\n=== BUTTONS ===');
console.log(JSON.stringify(buttons));

// Get tabs
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim())
);
console.log('\n=== TABS ===', JSON.stringify(tabs));

// Get grid cells (member table)
const extractCells = async (label) => {
  const cells = await page.evaluate(() => {
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
        if (r.width > 0 && r.height > 0 && t) cells.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
      }
    }
    return cells.sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 60);
  });
  console.log(`\n=== GRID CELLS (${label}) ===`);
  cells.forEach(c => console.log(JSON.stringify(c)));
};

await extractCells('main tab');

// Walk each tab
for (let i = 0; i < tabs.length; i++) {
  await page.evaluate((idx) => {
    const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
    if (allTabs[idx]) allTabs[idx].click();
  }, i);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `.auth/tz-comm-form-tab${i+1}.png`, fullPage: true });

  const fields = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('vaadin-form-item').forEach(fi => {
      const labelEl = fi.querySelector('[slot=label]');
      const labelTxt = labelEl ? (labelEl.innerText || '').trim() : '';
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
              value: String(el.value || '').substring(0, 100),
              readonly: el.hasAttribute('readonly'),
              y: Math.round(er.top), x: Math.round(er.left),
            });
          }
        });
      });
    });
    return items.sort((a, b) => a.y - b.y || a.x - b.x);
  });

  console.log(`\n=== TAB ${i+1}: ${tabs[i]} fields ===`);
  fields.forEach(f => console.log(JSON.stringify(f)));
  await extractCells(`tab${i+1}: ${tabs[i]}`);
}

// Now try to open an existing commission record (navigate to an existing id)
// From the list dump, we know: Проверка комиссии - 29 is id that exists
// Try a few IDs
for (const id of [29, 41, 36]) {
  await page.goto(BASE + `loan-application-commissions/${id}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  const url = page.url();
  if (url.includes(`/${id}`)) {
    console.log(`\n=== EXISTING RECORD id=${id} URL:`, url);
    await page.screenshot({ path: `.auth/tz-comm-record-${id}.png`, fullPage: true });

    // Extract fields
    const recFields = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('vaadin-form-item').forEach(fi => {
        const labelEl = fi.querySelector('[slot=label]');
        const labelTxt = labelEl ? (labelEl.innerText || '').trim() : '';
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
                value: String(el.value || '').substring(0, 100),
                readonly: el.hasAttribute('readonly'),
                y: Math.round(er.top), x: Math.round(er.left),
              });
            }
          });
        });
      });
      return items.sort((a, b) => a.y - b.y || a.x - b.x);
    });
    console.log(`Record ${id} fields:`, JSON.stringify(recFields, null, 2));

    const recButtons = await page.evaluate(() =>
      [...document.querySelectorAll('vaadin-button')]
        .filter(b => b.getBoundingClientRect().width > 0)
        .map(b => ({ t: (b.innerText || '').trim(), disabled: b.disabled }))
    );
    console.log(`Record ${id} buttons:`, JSON.stringify(recButtons));

    await extractCells(`record ${id}`);
    break; // got one, that's enough
  } else {
    console.log(`id=${id} redirected to:`, url);
  }
}

await ctx.close();
