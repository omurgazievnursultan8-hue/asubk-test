/**
 * probe-gov-statuscol7.mjs
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

// Check filter state
const filterDetails = await page.$('.jmix-generic-filter');
const filterHTML0 = await filterDetails.evaluate(e => e.outerHTML.substring(0, 300));
console.log('Filter element before expand:', filterHTML0);

// Click the filter summary to expand it
const summary = await page.$('.jmix-generic-filter vaadin-details-summary');
if (summary) {
  await summary.click();
  await page.waitForTimeout(1500);
  console.log('Clicked filter summary to expand');
}

await page.screenshot({ path: '.auth/statuscol-expanded.png' });

// Now the filter content should be visible
// Click the "Очистить поле" button (aria-label="Очистить поле" or id=entity_clear)
const clearBtn = await page.$('[aria-label="Очистить поле"]');
if (clearBtn) {
  const isVisible = await clearBtn.isVisible();
  console.log('Clear button visible:', isVisible);
  if (isVisible) {
    await clearBtn.click();
    await page.waitForTimeout(1000);
    console.log('Clicked clear button');
  } else {
    // force click
    await clearBtn.evaluate(e => e.click());
    await page.waitForTimeout(1000);
    console.log('Force-clicked clear button');
  }
} else {
  console.log('Clear button not found by aria-label, trying other ways');
  // Try by selector
  const allElements = await page.$$('.jmix-generic-filter *');
  for (const el of allElements) {
    const ariaLabel = await el.getAttribute('aria-label').catch(() => '');
    const id = await el.getAttribute('id').catch(() => '');
    if (ariaLabel && ariaLabel.includes('Очистить')) {
      console.log('Found clear element by aria-label:', ariaLabel, 'id:', id);
      await el.evaluate(e => e.click());
      await page.waitForTimeout(1000);
      break;
    }
  }
}

// Now click "Обновить" to apply the cleared filter
const allMenuItems = await page.$$('vaadin-menu-bar-item');
let refreshClicked = false;
for (const item of allMenuItems) {
  const text = await item.textContent().catch(() => '').then(t => t.trim());
  if (text === 'Обновить') {
    const isVisible = await item.isVisible();
    console.log('Обновить visible:', isVisible);
    if (isVisible) {
      await item.click();
    } else {
      await item.evaluate(e => e.click());
    }
    refreshClicked = true;
    console.log('Clicked Обновить');
    break;
  }
}
if (!refreshClicked) {
  console.log('Обновить not found as vaadin-menu-bar-item');
  // Try clicking the vaadin-menu-bar-button that contains "Обновить"
  const allBtns = await page.$$('vaadin-menu-bar-button');
  for (const btn of allBtns) {
    const text = await btn.textContent().catch(() => '').then(t => t.trim());
    if (text.includes('Обновить')) {
      await btn.evaluate(e => e.click());
      refreshClicked = true;
      console.log('Clicked Обновить via menu-bar-button');
      break;
    }
  }
}

await page.waitForTimeout(4000);
await page.screenshot({ path: '.auth/statuscol-after-clear.png' });

// Read all cells from the grid
const allCells = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')];
  return cells.map(c => (c.textContent || '').trim()).filter(Boolean);
});

console.log('ALL CELL VALUES:', JSON.stringify(allCells.slice(0, 200)));

// Status-like values
const statusLike = [...new Set(allCells)].filter(t =>
  /^(На стадии|На рассмотрен|Одобрен|Отклон|Закрыт|Подписан|Черновик|Утвержд|Проект|Активн|Заверш|Новый|В работе|Отменён|Приостановлен)/i.test(t)
);
console.log('DISTINCT STATUS-LIKE VALUES:', JSON.stringify(statusLike));

// Grid row count
const totalRows = await page.evaluate(() => {
  const grid = document.querySelector('vaadin-grid');
  return grid ? grid.size : null;
});
console.log('GRID ROW COUNT:', totalRows);

await ctx.close();
