/**
 * Open Штатное расписание + История + Закрытие sub-tabs for selected unit.
 * Follow-up to orgstruct-tree.mjs. Run: node scripts/inspect/orgstruct-staff.mjs
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
await page.locator('vaadin-grid-tree-toggle').first().click();
await page.waitForTimeout(1200);

// select root unit "Тест" (showed Штат 0 из 3 earlier)
await page.locator('vaadin-grid-cell-content', { hasText: 'Тест' }).first().click();
await page.waitForTimeout(1200);

const subtabs = ['Штатное расписание', 'История', 'Закрытие'];
for (const t of subtabs) {
  console.log('\n=== SUBTAB:', t, '===');
  const loc = page.locator('[role=tab]', { hasText: t }).last();
  await loc.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `.auth/org-structure-07-${t.replace(/\s+/g, '_')}.png`, fullPage: true });
  const bodyText = await page.locator('body').innerText();
  console.log(bodyText.slice(bodyText.indexOf('Обзор\nШтатное расписание'), bodyText.indexOf('Обзор\nШтатное расписание') + 2500));
  const buttons = (await page.locator('vaadin-button, button').allInnerTexts()).filter(Boolean);
  console.log('--- BUTTONS ---', JSON.stringify(buttons.slice(0, 40)));
}

await ctx.close();
