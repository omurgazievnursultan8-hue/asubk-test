/**
 * Verify: does "Отдел бухгалтерского учёта" actually have staff units?
 * Dashboard says "Нет штатного расписания", Закрытие gate says opposite.
 * Run: node scripts/inspect/orgstruct-verify-contradiction.mjs
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
await page.waitForTimeout(1200);

for (let i = 0; i < 5; i++) {
  const toggles = page.locator('vaadin-grid-tree-toggle:visible');
  const n = await toggles.count();
  let clicked = 0;
  for (let j = 0; j < n; j++) {
    const expanded = await toggles.nth(j).getAttribute('expanded');
    if (expanded === null) { await toggles.nth(j).click().catch(() => {}); clicked++; await page.waitForTimeout(400); }
  }
  if (!clicked) break;
}
await page.waitForTimeout(500);

await page.locator('vaadin-grid-cell-content:visible', { hasText: 'Отдел бухгалтерского учёта' }).first().click();
await page.waitForTimeout(1000);
console.log('=== Обзор tab for Отдел бухгалтерского учёта ===');
console.log((await page.locator('body').innerText()).slice(0, 2000));

await page.locator('[role=tab]', { hasText: 'Штатное расписание' }).last().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: '.auth/org-structure-16-contradiction-check.png', fullPage: true });
console.log('\n=== Штатное расписание tab for Отдел бухгалтерского учёта ===');
console.log((await page.locator('body').innerText()).slice(0, 2500));

const gridRows = await page.locator('vaadin-grid-cell-content:visible').allInnerTexts();
console.log('\ngrid cells:', JSON.stringify(gridRows));

await ctx.close();
