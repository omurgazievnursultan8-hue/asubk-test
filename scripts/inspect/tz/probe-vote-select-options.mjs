// scripts/inspect/tz/probe-vote-select-options.mjs
// Opens commission vote dialog and expands the «Решение» select to get options
// Usage: node scripts/inspect/tz/probe-vote-select-options.mjs
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

await page.goto(BASE + 'loan-application-commissions/30', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Click «Проголосовать»
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('vaadin-button')].find(b => (b.innerText||'').trim() === 'Проголосовать');
  if (btn) btn.click();
});
await page.waitForTimeout(3000);

console.log('Vote dialog text:', await page.evaluate(() => {
  const ov = document.querySelector('vaadin-dialog-overlay');
  return ov ? (ov.innerText||'').substring(0, 300) : 'no overlay';
}));

// Find and click the «Решение» select inside the dialog to open its dropdown
const selectClicked = await page.evaluate(() => {
  const overlay = document.querySelector('vaadin-dialog-overlay');
  if (!overlay) return 'no overlay';
  const selects = overlay.querySelectorAll('vaadin-select');
  if (selects.length === 0) return 'no selects in overlay';
  const sel = selects[0];
  sel.click();
  return `clicked select with value=${sel.value}, options=${sel.innerHTML.substring(0,200)}`;
});
console.log('Select click:', selectClicked);
await page.waitForTimeout(1500);
await page.screenshot({ path: '.auth/tz-vote-select-open.png', fullPage: false });

// Get all visible vaadin-items (dropdown options)
const dropdownItems = await page.evaluate(() => {
  // Try vaadin-list-box items
  const items = [];
  document.querySelectorAll('vaadin-item, vaadin-list-box vaadin-item').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) items.push({ t: (el.innerText||'').trim(), y: Math.round(r.top), value: el.value });
  });
  // Also check select-overlay
  const overlayItems = document.querySelectorAll('vaadin-select-overlay vaadin-item');
  overlayItems.forEach(el => {
    const r = el.getBoundingClientRect();
    items.push({ t: (el.innerText||'').trim(), y: Math.round(r.top), value: el.value, source: 'select-overlay' });
  });
  return items;
});
console.log('DROPDOWN ITEMS:', JSON.stringify(dropdownItems));

// Get the select's inner HTML to see option values
const selectOptions = await page.evaluate(() => {
  const overlay = document.querySelector('vaadin-dialog-overlay');
  if (!overlay) return [];
  const selects = overlay.querySelectorAll('vaadin-select');
  return [...selects].map(s => ({
    value: s.value,
    innerHTML: s.innerHTML.substring(0, 500),
    items: s._overlayElement ? (s._overlayElement.innerText||'') : '',
  }));
});
console.log('SELECT OPTION HTML:', JSON.stringify(selectOptions));

// Try to read select items via shadow root
const shadowItems = await page.evaluate(() => {
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  const items = [];
  for (const el of walkAll(document)) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'vaadin-item' || tag === 'vaadin-select-item') {
      const r = el.getBoundingClientRect();
      const t = (el.innerText || el.textContent || '').trim();
      if (t) items.push({ tag, t, visible: r.width > 0, y: Math.round(r.top) });
    }
  }
  return items.slice(0, 30);
});
console.log('SHADOW ITEMS:', JSON.stringify(shadowItems));

// Also check the vote dialog label
const dialogLabels = await page.evaluate(() => {
  const overlay = document.querySelector('vaadin-dialog-overlay');
  if (!overlay) return [];
  const results = [];
  overlay.querySelectorAll('label, [slot=label]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) results.push({ t: (el.innerText||el.textContent||'').trim(), y: Math.round(r.top) });
  });
  return results.sort((a,b) => a.y - b.y);
});
console.log('DIALOG LABELS:', JSON.stringify(dialogLabels));

await ctx.close();
