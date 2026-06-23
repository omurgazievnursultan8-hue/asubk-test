// scripts/inspect/tz/probe-edit-values.mjs
// Navigate to loan-programs list, get program IDs from grid links,
// then open each one directly and read tab 2/3 values.
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

// ─── Helper: extract field values ────────────────────────────────────────────
const extractFieldsWithValues = () => page.evaluate(() => {
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
    // For select: try to get the displayed text
    if (el.tagName.toLowerCase() === 'vaadin-select') {
      const overlay = el.shadowRoot?.querySelector('vaadin-select-value-button');
      if (overlay) return overlay.innerText?.trim() || el.value;
      return el.value;
    }
    if (el.value !== undefined && el.value !== null && el.value !== '') return String(el.value);
    if (el.checked !== undefined) return el.checked ? 'true' : 'false';
    if (el.shadowRoot) {
      const inp = el.shadowRoot.querySelector('input');
      if (inp && inp.value) return inp.value;
    }
    return null;
  };
  return [...document.querySelectorAll(TAGS.join(','))]
    .filter(e => e.getBoundingClientRect().width > 0)
    .map(el => ({
      tag: el.tagName.toLowerCase(),
      label: labelOf(el),
      value: valueOf(el),
      y: Math.round(el.getBoundingClientRect().top),
      x: Math.round(el.getBoundingClientRect().left),
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
});

// Navigate to list and click on a row directly (double click)
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Try double-clicking on first data row to open it
const doubleClickResult = await page.evaluate(() => {
  // Get all grid body rows via vaadin-grid
  const grid = document.querySelector('vaadin-grid');
  if (!grid) return { ok: false, reason: 'no vaadin-grid' };
  // Try to access grid items
  const items = grid._dataProviderController?.rootCache?.items || [];
  return { ok: true, itemCount: items.length };
});
console.log('Grid probe:', JSON.stringify(doubleClickResult));

// Try selecting first row and clicking Изменить using keyboard selection
await page.keyboard.press('Tab'); // focus grid
await page.waitForTimeout(500);

// Use row click approach - click on a cell in the first data row
const cellClick = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')].filter(c => {
    const r = c.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top > 300; // skip header rows
  });
  if (cells[0]) {
    const r = cells[0].getBoundingClientRect();
    return { text: cells[0].innerText, y: r.top, x: r.left };
  }
  return null;
});
console.log('First data cell:', JSON.stringify(cellClick));

if (cellClick) {
  await page.mouse.click(cellClick.x + 5, cellClick.y + 5);
  await page.waitForTimeout(1000);

  // Click Изменить
  const izmBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('vaadin-button')].find(b => /Изменить/i.test(b.innerText));
    if (b) { const r = b.getBoundingClientRect(); return { found: !b.disabled, y: r.top, x: r.left, disabled: b.disabled }; }
    return { found: false };
  });
  console.log('Изменить button:', JSON.stringify(izmBtn));

  if (izmBtn.found && !izmBtn.disabled) {
    await page.mouse.click(izmBtn.x + 5, izmBtn.y + 5);
    await page.waitForTimeout(4000);
    console.log('URL after click:', page.url());
  }
}

// If still on list, try direct URL navigation
if (page.url().includes('/loan-programs') && !page.url().match(/loan-programs\/.+/)) {
  console.log('Still on list — trying to extract program ID from grid');

  // Try to read any href or id attributes from the grid
  const linkData = await page.evaluate(() => {
    function* walkAll(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node = walker.nextNode();
      while (node) {
        yield node;
        if (node.shadowRoot) yield* walkAll(node.shadowRoot);
        node = walker.nextNode();
      }
    }
    const links = [];
    for (const el of walkAll(document)) {
      if (el.href && el.href.includes('loan-programs')) links.push(el.href);
    }
    return [...new Set(links)];
  });
  console.log('Links found:', JSON.stringify(linkData));
}

// Alternative: use the Изменить button via Playwright locator
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Click first data row using Playwright
try {
  // Find first row content
  const firstRowContent = page.locator('vaadin-grid-cell-content').filter({ hasText: /тест|программ|ФРР|ТУР|Осмонов|Газификация|Агро/i }).first();
  await firstRowContent.click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  console.log('Clicked first row');

  // Check if Изменить is now enabled
  const izmEnabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('vaadin-button')].find(b => /Изменить/i.test(b.innerText));
    return b ? { disabled: b.disabled, text: b.innerText } : null;
  });
  console.log('Изменить after row click:', JSON.stringify(izmEnabled));

  if (izmEnabled && !izmEnabled.disabled) {
    await page.click('vaadin-button:has-text("Изменить")');
    await page.waitForTimeout(4000);
    console.log('URL:', page.url());

    const urlAfter = page.url();
    if (urlAfter.match(/loan-programs\/.+/)) {
      // We're in an edit form - go to tab 2
      await page.evaluate(() => {
        const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
        allTabs[1] && allTabs[1].click();
      });
      await page.waitForTimeout(2000);

      const tab2 = await extractFieldsWithValues();
      console.log('EDIT Tab 2 fields:', JSON.stringify(tab2, null, 2));
      await page.screenshot({ path: '.auth/probe-edit2-tab2.png', fullPage: true });

      // Check select options on tab2
      await page.evaluate(() => {
        const selects = [...document.querySelectorAll('vaadin-select')].filter(e => e.getBoundingClientRect().width > 0);
        if (selects[0]) selects[0].click();
      });
      await page.waitForTimeout(1000);
      const opts = await page.evaluate(() => {
        return [...document.querySelectorAll('vaadin-select-item')].filter(i => i.getBoundingClientRect().height > 0).map(i => ({ text: i.innerText.trim(), value: i.value }));
      });
      console.log('Tab2 select[0] options:', JSON.stringify(opts));

      // Press Escape to close dropdown
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Go to tab 3
      await page.evaluate(() => {
        const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
        allTabs[2] && allTabs[2].click();
      });
      await page.waitForTimeout(2000);

      const tab3 = await extractFieldsWithValues();
      console.log('EDIT Tab 3 fields:', JSON.stringify(tab3, null, 2));
      await page.screenshot({ path: '.auth/probe-edit2-tab3.png', fullPage: true });
    }
  }
} catch (e) {
  console.log('Locator approach failed:', e.message);
}

// Last resort: try all programs until we find one with tab2 content
console.log('\n=== Trying each row to open edit form ===');
await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Get all row positions
const rowPositions = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')].filter(c => {
    const r = c.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top > 290 && r.top < 700;
  });
  // Group by Y position to find distinct rows
  const rowsByY = {};
  cells.forEach(c => {
    const r = c.getBoundingClientRect();
    const y = Math.round(r.top / 10) * 10;
    if (!rowsByY[y]) rowsByY[y] = { y: r.top, x: r.left, text: c.innerText.trim() };
  });
  return Object.values(rowsByY).sort((a, b) => a.y - b.y);
});
console.log('Row positions:', JSON.stringify(rowPositions));

for (const row of rowPositions.slice(0, 3)) {
  await page.mouse.click(row.x + 10, row.y + 5);
  await page.waitForTimeout(800);

  const izmBtn2 = await page.evaluate(() => {
    const b = [...document.querySelectorAll('vaadin-button')].find(b => /Изменить/i.test(b.innerText) && !b.disabled);
    return b ? { found: true, disabled: b.disabled } : { found: false };
  });

  if (izmBtn2.found) {
    await page.click('vaadin-button:has-text("Изменить")');
    await page.waitForTimeout(4000);
    const url = page.url();
    console.log('Opened:', url);

    if (url.match(/loan-programs\/.+/)) {
      // Read tab 1 value (name)
      const t1 = await extractFieldsWithValues();
      const nameField = t1.find(f => f.label && /русском/i.test(f.label));
      console.log('Program name:', nameField?.value);

      // Tab 2
      await page.evaluate(() => {
        const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
        allTabs[1] && allTabs[1].click();
      });
      await page.waitForTimeout(2000);
      const t2 = await extractFieldsWithValues();
      console.log('Tab 2 fields:');
      t2.forEach(f => console.log(`  ${f.tag} label="${f.label}" value="${f.value}"`));
      await page.screenshot({ path: `.auth/probe-row-tab2-${row.y}.png`, fullPage: true });

      // Tab 3
      await page.evaluate(() => {
        const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
        allTabs[2] && allTabs[2].click();
      });
      await page.waitForTimeout(2000);
      const t3 = await extractFieldsWithValues();
      console.log('Tab 3 fields:');
      t3.forEach(f => console.log(`  ${f.tag} label="${f.label}" value="${f.value}"`));
      await page.screenshot({ path: `.auth/probe-row-tab3-${row.y}.png`, fullPage: true });

      // Go back to list
      await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2000);
      break; // found one, that's enough
    }
    await page.goto(BASE + 'loan-programs', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
  }
}

await ctx.close();
console.log('\nDONE');
