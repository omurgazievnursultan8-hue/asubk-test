/**
 * Expand Подразделения tree, select root + child, probe detail-card tabs
 * (Обзор/Штатное расписание/История/Ликвидация). Follow-up to orgstruct-tabs.mjs.
 * Run: node scripts/inspect/orgstruct-tree.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
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
  await page.waitForTimeout(2000);
}

await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

await page.locator('[role=tab]', { hasText: 'Подразделения' }).first().click();
await page.waitForTimeout(1500);

// expand root via tree-toggle
const toggle = page.locator('vaadin-grid-tree-toggle').first();
await toggle.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '.auth/org-structure-05-tree-expanded.png', fullPage: true });

let bodyText = await page.locator('body').innerText();
console.log('--- AFTER EXPAND (first 3000) ---');
console.log(bodyText.slice(0, 3000));

// click root row "Тест" to select it
const rootCell = page.locator('vaadin-grid-cell-content', { hasText: 'Тест' }).first();
await rootCell.click().catch(async () => {
  await page.getByText('Тест', { exact: false }).first().click();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: '.auth/org-structure-06-root-selected.png', fullPage: true });

bodyText = await page.locator('body').innerText();
console.log('--- AFTER SELECT ROOT (first 4000) ---');
console.log(bodyText.slice(0, 4000));

const detailTabs = await page.locator('[role=tab]').allInnerTexts();
console.log('--- DETAIL TABS ---', JSON.stringify(detailTabs));

await ctx.close();
