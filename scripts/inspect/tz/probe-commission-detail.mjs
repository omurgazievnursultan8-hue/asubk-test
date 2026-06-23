// scripts/inspect/tz/probe-commission-detail.mjs
// Inspects loan-application-commissions detail form (Просмотр)
// Usage: node scripts/inspect/tz/probe-commission-detail.mjs
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

// Select first row
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
  cells.sort((a,b) => a.top - b.top || a.left - b.left);
  if (cells.length > 8) cells[8].el.click();
});
await page.waitForTimeout(800);

// Click Просмотр
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Просмотр');
  if (btn) btn.click();
});
await page.waitForTimeout(4000);
console.log('COMMISSION DETAIL URL:', page.url());
await page.screenshot({ path: '.auth/tz-commission-detail-view.png', fullPage: true });

// Get tabs
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-tab')]
    .filter(t => t.getBoundingClientRect().width > 0)
    .map(t => t.innerText.trim())
);
console.log('TABS:', JSON.stringify(tabs));

// Get header fields
const headerFields = await page.evaluate(() => {
  const items = [];
  document.querySelectorAll('vaadin-form-item').forEach(fi => {
    const r = fi.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.top > 400) return;
    const labelEl = fi.querySelector('[slot=label]');
    const labelTxt = labelEl ? (labelEl.innerText||'').trim() : '';
    const FTAGS = ['vaadin-text-field','jmix-value-picker','vaadin-select','vaadin-date-picker'];
    FTAGS.forEach(ft => {
      fi.querySelectorAll(ft).forEach(f => {
        if (f.getBoundingClientRect().width > 0) {
          items.push({ label: labelTxt || f.getAttribute('label') || '', tag: f.tagName.toLowerCase(), value: String(f.value||'').substring(0,100), y: Math.round(r.top) });
        }
      });
    });
  });
  return items.sort((a,b) => a.y - b.y);
});
console.log('HEADER FIELDS:', JSON.stringify(headerFields));

// Get vote progress info
const voteInfo = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('*').forEach(el => {
    const cls = (el.className||'').toString();
    const t = (el.innerText||'').trim();
    if ((cls.includes('progress') || cls.includes('vote') || cls.includes('tally') || cls.includes('голос')) && t && t.length < 200) {
      results.push({ tag: el.tagName.toLowerCase(), cls: cls.substring(0,60), t: t.substring(0,200) });
    }
  });
  return results.slice(0, 10);
});
console.log('VOTE/PROGRESS:', JSON.stringify(voteInfo));

// Walk all tabs
const extractFields = async () => page.evaluate(() => {
  const TAGS = ['vaadin-text-field','vaadin-text-area','vaadin-big-decimal-field',
    'vaadin-number-field','vaadin-integer-field','jmix-value-picker',
    'jmix-multi-value-picker','vaadin-combo-box','vaadin-select',
    'vaadin-checkbox','vaadin-date-picker'];
  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => e.getBoundingClientRect().width > 0)
    .map(el => {
      const r = el.getBoundingClientRect();
      const fi = el.closest('vaadin-form-item');
      const labelEl = fi ? fi.querySelector('[slot=label]') : null;
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute('label') || (labelEl ? (labelEl.innerText||'').trim() : '') || ''),
        value: String(el.value||'').substring(0,100),
        readonly: el.hasAttribute('readonly'),
        y: Math.round(r.top), x: Math.round(r.left),
      };
    }).sort((a,b) => a.y - b.y || a.x - b.x);
});

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
  return cells.sort((a,b)=>a.y-b.y||a.x-b.x).slice(0,40);
});

const extractButtons = async () => page.evaluate(() =>
  [...document.querySelectorAll('vaadin-button')]
    .filter(b => b.getBoundingClientRect().width > 0)
    .map(b => (b.innerText||'').trim())
    .filter(t => t && t.length > 1 && t.length < 60)
);

for (let i = 0; i < tabs.length; i++) {
  await page.evaluate((idx) => {
    const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
    allTabs[idx] && allTabs[idx].click();
  }, i);
  await page.waitForTimeout(2000);

  const fields = await extractFields();
  const cells = await extractCells();
  const buttons = await extractButtons();
  await page.screenshot({ path: `.auth/tz-comm-tab${i+1}.png`, fullPage: true });

  console.log(`\n--- COMMISSION TAB ${i+1}: ${tabs[i]} ---`);
  console.log('fields:', JSON.stringify(fields.slice(0,30)));
  console.log('cells:', JSON.stringify(cells.slice(0,25)));
  console.log('buttons:', JSON.stringify(buttons));
}

// Also inspect Изменить (edit) for a commission that has an Одобрено decision
// to see protocol fields
await page.goto(BASE + 'loan-application-commissions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// Find a commission with "Одобрено" in the list
const commRows = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const rows = [];
  let currentRow = [];
  let lastY = -1;
  for (const el of walkAll(document)) {
    if (el.tagName.toLowerCase() === 'vaadin-grid-cell-content') {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.top < 350) continue;
      const t = (el.textContent||'').trim().replace(/\s+/g,' ');
      if (!t) continue;
      const y = Math.round(r.top);
      if (Math.abs(y - lastY) > 20 && currentRow.length > 0) {
        rows.push(currentRow);
        currentRow = [];
      }
      currentRow.push({ t, y, x: Math.round(r.left) });
      lastY = y;
    }
  }
  if (currentRow.length) rows.push(currentRow);
  return rows.slice(0, 15);
});
console.log('\n=== COMMISSION LIST ROWS ===');
commRows.forEach((row, i) => console.log(`Row ${i}:`, JSON.stringify(row.map(c => c.t))));

await ctx.close();
