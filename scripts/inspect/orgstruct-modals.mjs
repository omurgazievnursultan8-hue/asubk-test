/**
 * Open Назначить / И.о.: назначить / Добавить единицу modals (no submit) to check
 * fields against P11-R9/R10. Follow-up to orgstruct-staff.mjs.
 * Run: node scripts/inspect/orgstruct-modals.mjs
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
await page.locator('vaadin-grid-tree-toggle').first().click();
await page.waitForTimeout(1000);
await page.locator('vaadin-grid-cell-content:visible', { hasText: 'Тест' }).first().click();
await page.waitForTimeout(1000);
await page.locator('[role=tab]', { hasText: 'Штатное расписание' }).last().click();
await page.waitForTimeout(1000);

// select the Бухгалтер row (vacant, 2 free) then open Назначить
await page.locator('vaadin-grid-cell-content:visible', { hasText: 'Бухгалтер' }).first().click();
await page.waitForTimeout(800);

console.log('=== Назначить modal ===');
await page.locator('vaadin-button:visible', { hasText: 'Назначить' }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '.auth/org-structure-08-modal-naznachit.png', fullPage: true });
console.log((await page.locator('body').innerText()).slice(-3000));
await page.locator('vaadin-button:visible, button:visible', { hasText: 'Отмена' }).first().click();
await page.waitForTimeout(800);

console.log('\n=== И.о.: назначить modal ===');
await page.locator('vaadin-grid-cell-content:visible', { hasText: 'Руководитель' }).first().click();
await page.waitForTimeout(800);
await page.locator('vaadin-button:visible', { hasText: 'И.о.: назначить' }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '.auth/org-structure-09-modal-io.png', fullPage: true });
console.log((await page.locator('body').innerText()).slice(-3000));
await page.locator('vaadin-button:visible, button:visible', { hasText: 'Отмена' }).first().click();
await page.waitForTimeout(800);

console.log('\n=== Добавить единицу modal ===');
await page.locator('vaadin-button:visible', { hasText: 'Добавить единицу' }).first().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '.auth/org-structure-10-modal-add-unit.png', fullPage: true });
console.log((await page.locator('body').innerText()).slice(-3000));
await page.keyboard.press('Escape');

await ctx.close();
