/**
 * probe-gov-statuscol6.mjs
 * Clears the default «фильтр по статусу» on the gov-decisions list,
 * then reads all distinct status values from the grid.
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

// Step 1: Expand the filter (click the summary to toggle if closed)
// The filter starts opened=true, but let's ensure it's expanded
const filterDetails = await page.$('.jmix-generic-filter');
const isOpened = await filterDetails.getAttribute('opened');
console.log('Filter initially opened:', isOpened);

if (!isOpened) {
  // Expand it
  const summary = await page.$('.jmix-generic-filter vaadin-details-summary');
  await summary.click();
  await page.waitForTimeout(1000);
}

// Step 2: Click the "Очистить поле" (clear) button inside the status filter
// It's: jmix-value-picker-button#entity_clear
const clearBtn = await page.$('#propertyFilter_creditOrderState_valueComponent #entity_clear');
if (clearBtn) {
  await clearBtn.click();
  await page.waitForTimeout(1000);
  console.log('Clicked clear button on status filter');
} else {
  console.log('WARNING: entity_clear button not found, trying alternative');
  // Try by aria-label
  const clearByLabel = await page.$('[aria-label="Очистить поле"]');
  if (clearByLabel) {
    await clearByLabel.click();
    await page.waitForTimeout(1000);
    console.log('Clicked clear by aria-label');
  }
}

// Step 3: Click the "Обновить" button to apply the cleared filter
// It's inside jmix-combo-button with text "Обновить"
const allMenuItems = await page.$$('vaadin-menu-bar-item');
let refreshClicked = false;
for (const item of allMenuItems) {
  const text = await item.textContent().catch(() => '').then(t => t.trim());
  if (text === 'Обновить') {
    await item.click();
    refreshClicked = true;
    console.log('Clicked Обновить');
    break;
  }
}
if (!refreshClicked) {
  console.log('WARNING: Обновить not found');
}

await page.waitForTimeout(3000);
await page.screenshot({ path: '.auth/statuscol-cleared.png' });

// Step 4: Read all distinct status values from the grid
// The status column is the 3rd column (index 2) based on header: Наименование, Краткое наименование, Статус, ...
const allCells = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')];
  return cells.map(c => (c.textContent || '').trim()).filter(Boolean);
});

console.log('ALL CELL VALUES (first 150):', JSON.stringify(allCells.slice(0, 150)));

// Find status column index from headers
const headerIdx = allCells.indexOf('Статус');
console.log('Status header at index:', headerIdx);

// Status-like values (known Russian status words)
const statusLike = [...new Set(allCells)].filter(t =>
  /^(На стадии|На рассмотрен|Одобрен|Отклон|Закрыт|Подписан|Черновик|Утвержд|Проект|Активн|Заверш|Новый|В работе|Отменён|Приостановлен)/i.test(t)
);
console.log('DISTINCT STATUS-LIKE VALUES:', JSON.stringify(statusLike));

// Also scroll grid to load more rows if paged
const totalRows = await page.evaluate(() => {
  const grid = document.querySelector('vaadin-grid');
  return grid ? grid.size : 'unknown';
});
console.log('GRID ROW COUNT:', totalRows);

// Load all rows by scrolling
await page.evaluate(async () => {
  const grid = document.querySelector('vaadin-grid');
  if (!grid) return;
  for (let i = 0; i < 20; i++) {
    grid.scrollToIndex(i * 10);
    await new Promise(r => setTimeout(r, 200));
  }
});
await page.waitForTimeout(2000);

const allCells2 = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')];
  return cells.map(c => (c.textContent || '').trim()).filter(Boolean);
});

const statusLike2 = [...new Set(allCells2)].filter(t =>
  /^(На стадии|На рассмотрен|Одобрен|Отклон|Закрыт|Подписан|Черновик|Утвержд|Проект|Активн|Заверш|Новый|В работе|Отменён|Приостановлен)/i.test(t)
);
console.log('DISTINCT STATUS-LIKE VALUES (after scroll):', JSON.stringify(statusLike2));
console.log('ALL CELL VALUES AFTER SCROLL (first 200):', JSON.stringify(allCells2.slice(0, 200)));

await ctx.close();
