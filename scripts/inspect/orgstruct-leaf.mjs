/**
 * Select a leaf unit "Отдел учёта" (no children), check Закрытие tab gate state,
 * then click Экспорт структуры / Паспорт на дату on Обзор.
 * Run: node scripts/inspect/orgstruct-leaf.mjs
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

console.log('=== select leaf "Отдел бухгалтерского учёта" ===');
await page.locator('vaadin-grid-cell-content:visible', { hasText: 'Отдел бухгалтерского учёта' }).first().click();
await page.waitForTimeout(1000);
console.log('overview text:', (await page.locator('body').innerText()).slice(0, 1500));

await page.locator('[role=tab]', { hasText: 'Закрытие' }).last().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: '.auth/org-structure-14-leaf-zakrytie.png', fullPage: true });
console.log('Закрытие tab text:', (await page.locator('body').innerText()).slice(-2000));

console.log('\n=== back to Обзор, click Экспорт структуры ===');
await page.locator('[role=tab]', { hasText: 'Подразделения' }).first().click();
await page.waitForTimeout(1000);
await page.locator('[role=tab]', { hasText: 'Обзор' }).first().click();
await page.waitForTimeout(1000);
await page.locator('vaadin-button:visible', { hasText: 'Экспорт структуры' }).first().click();
await page.waitForTimeout(2000);
console.log('after Экспорт click, body tail:', (await page.locator('body').innerText()).slice(-1200));
const downloads1 = await page.context().pages().length;
console.log('page count after export click:', downloads1);

console.log('\n=== click Паспорт на дату ===');
await page.locator('vaadin-button:visible', { hasText: 'Паспорт на дату' }).first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: '.auth/org-structure-15-passport.png', fullPage: true });
console.log('after Паспорт click, body tail:', (await page.locator('body').innerText()).slice(-1200));

await ctx.close();
