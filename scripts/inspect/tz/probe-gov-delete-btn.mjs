/**
 * probe-gov-delete-btn.mjs
 * Verify that Удалить button is accessible (not disabled) regardless of record status.
 * Tests by clicking each row and checking button state.
 *
 * Verification: 2026-06-23
 */
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2000);
}

// Load gov-decisions list
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Clear the filter first (same approach as probe-gov-statuscol7)
const summary = await page.$('.jmix-generic-filter vaadin-details-summary');
if (summary) {
  await summary.click();
  await page.waitForTimeout(1000);
}
const clearBtn = await page.$('[aria-label="Очистить поле"]');
if (clearBtn) await clearBtn.evaluate(e => e.click());
await page.waitForTimeout(500);
const menuItems = await page.$$('vaadin-menu-bar-item');
for (const item of menuItems) {
  const t = await item.textContent().catch(() => '').then(t => t.trim());
  if (t === 'Обновить') { await item.evaluate(e => e.click()); break; }
}
await page.waitForTimeout(3000);

// Get the Удалить button
const removeBtn = await page.$('#removeButton');
if (!removeBtn) { console.log('ERROR: remove button not found'); await ctx.close(); process.exit(1); }

// Get all grid rows
const rows = await page.$$('vaadin-grid-cell-content');
// Find rows by reading grid data - click each row in turn
const gridRows = await page.evaluate(() => {
  const grid = document.querySelector('vaadin-grid');
  const size = grid ? grid.size : 0;
  return size;
});
console.log('Total rows:', gridRows);

// Click rows one by one to check Удалить state
const results = [];
for (let i = 0; i < gridRows; i++) {
  // Scroll to row and click it
  await page.evaluate((idx) => {
    const grid = document.querySelector('vaadin-grid');
    if (grid) grid.scrollToIndex(idx);
  }, i);
  await page.waitForTimeout(300);

  // Find the row at this index and click it
  const allCells = await page.$$('vaadin-grid-cell-content');
  // Skip header cells: the first 7 cells are headers (7 columns)
  // Row i starts at offset 7 + i*7
  const rowOffset = 7 + i * 7;
  if (rowOffset < allCells.length) {
    const cell = allCells[rowOffset];
    await cell.click().catch(() => {});
    await page.waitForTimeout(300);

    // Get status text from this row (3rd column = index 2)
    const statusIdx = rowOffset + 2; // Статус is 3rd column
    const statusText = statusIdx < allCells.length ?
      await allCells[statusIdx].textContent().then(t => t.trim()) : 'N/A';

    const nameIdx = rowOffset;
    const nameText = nameIdx < allCells.length ?
      await allCells[nameIdx].textContent().then(t => t.trim()) : 'N/A';

    // Check Удалить button state
    const removeBtnDisabled = await removeBtn.evaluate(e =>
      e.disabled || e.hasAttribute('disabled') || e.getAttribute('tabindex') === '-1'
    );
    const removeBtnTheme = await removeBtn.getAttribute('theme').catch(() => '');

    results.push({ i, name: nameText.substring(0, 30), status: statusText, disabled: removeBtnDisabled, theme: removeBtnTheme });
  }
}

console.log('УДАЛИТЬ BUTTON STATE PER ROW:');
for (const r of results) {
  console.log(`  Row ${r.i}: status="${r.status}" name="${r.name}" disabled=${r.disabled} theme="${r.theme}"`);
}

await ctx.close();
