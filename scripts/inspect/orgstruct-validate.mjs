/**
 * Validation probes: Ставок stepper floor at 1, И.о. duration >183d, Тип dropdown
 * options, Дата просмотра min/max. Follow-up to orgstruct-modals.mjs.
 * Run: node scripts/inspect/orgstruct-validate.mjs
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

console.log('=== Дата просмотра input attrs ===');
const dateInput = page.locator('input').first();
console.log('min/max/value:', await page.evaluate(() => {
  const el = document.querySelector('vaadin-date-picker input') || document.querySelector('input[type=text]');
  return el ? { min: el.min, max: el.max, value: el.value } : 'not found via simple query';
}));

await page.locator('[role=tab]', { hasText: 'Подразделения' }).first().click();
await page.waitForTimeout(1200);
await page.locator('vaadin-grid-tree-toggle').first().click();
await page.waitForTimeout(1000);
await page.locator('vaadin-grid-cell-content:visible', { hasText: 'Тест' }).first().click();
await page.waitForTimeout(1000);
await page.locator('[role=tab]', { hasText: 'Штатное расписание' }).last().click();
await page.waitForTimeout(1000);

console.log('\n=== Ставок stepper floor test (Добавить единицу) ===');
await page.locator('vaadin-button:visible', { hasText: 'Добавить единицу' }).first().click();
await page.waitForTimeout(1200);
const minusBtn = page.locator('vaadin-dialog-overlay vaadin-integer-field button, vaadin-dialog-overlay [part=decrease-button]').first();
for (let i = 0; i < 3; i++) {
  await minusBtn.click().catch(() => console.log('decrease click failed at i=', i));
  await page.waitForTimeout(300);
}
const stavokVal = await page.locator('vaadin-dialog-overlay input').nth(1).inputValue().catch(() => 'n/a');
console.log('Ставок value after 3x decrement from 1:', stavokVal);
await page.locator('vaadin-button:visible, button:visible', { hasText: 'Отмена' }).first().click();
await page.waitForTimeout(800);

console.log('\n=== И.о. duration >183 days test ===');
await page.locator('vaadin-grid-cell-content:visible', { hasText: 'Руководитель' }).first().click();
await page.waitForTimeout(800);
await page.locator('vaadin-button:visible', { hasText: 'И.о.: назначить' }).first().click();
await page.waitForTimeout(1200);
console.log('date-pickers in overlay:', await page.locator('vaadin-dialog-overlay vaadin-date-picker:visible').count());
console.log('overlay text:', (await page.locator('vaadin-dialog-overlay').innerText()).slice(0, 1500));
// set Дата окончания to 300 days out (well past 183) via direct fill
const endInput = page.locator('vaadin-dialog-overlay vaadin-date-picker:visible').last().locator('input');
await endInput.fill('01.06.2027');
await page.keyboard.press('Tab');
await page.waitForTimeout(800);
await page.screenshot({ path: '.auth/org-structure-11-io-overlimit.png', fullPage: true });
console.log('body text tail:', (await page.locator('body').innerText()).slice(-1500));
// try clicking OK without selecting employee to see validation
await page.locator('vaadin-button:visible', { hasText: 'OK' }).first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: '.auth/org-structure-12-io-validation.png', fullPage: true });
console.log('after OK click, body tail:', (await page.locator('body').innerText()).slice(-1500));
await page.locator('vaadin-button:visible, button:visible', { hasText: 'Отмена' }).first().click().catch(() => {});

await ctx.close();
