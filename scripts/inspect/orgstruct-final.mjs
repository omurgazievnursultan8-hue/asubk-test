/**
 * Final probes: leaf-unit Закрытие (unblocked liquidation gate), Экспорт/Паспорт buttons.
 * Run: node scripts/inspect/orgstruct-final.mjs
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

// expand all tree-toggles repeatedly to reveal leaves
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
await page.screenshot({ path: '.auth/org-structure-13-tree-fully-expanded.png', fullPage: true });

const rows = await page.locator('vaadin-grid-cell-content:visible').allInnerTexts();
console.log('all visible tree cell texts:', JSON.stringify(rows));

await ctx.close();
