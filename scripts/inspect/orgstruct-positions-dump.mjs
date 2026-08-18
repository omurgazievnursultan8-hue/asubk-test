/** Dump «Должности» dictionary + the «Добавить штатную единицу» form. READ-ONLY. */
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1680, height: 1050 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]','admin'); await page.fill('input[name=password]','admin');
  await Promise.all([page.waitForNavigation({waitUntil:'networkidle',timeout:60000}).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
const MAIN = 'vaadin-app-layout > vaadin-vertical-layout:not([slot])';

await page.locator('[role=tab]', { hasText: 'Должности' }).first().click();
await page.waitForTimeout(1800);
console.log('=== ДОЛЖНОСТИ (tab text) ===');
console.log((await page.locator(MAIN).first().innerText()).slice(0, 3000));
await page.screenshot({ path: '.auth/orgstruct-positions-tab.png', fullPage: true });

// dialog fields for a new position
const btns = (await page.locator(MAIN + ' vaadin-button, ' + MAIN + ' button').allInnerTexts()).filter(Boolean);
console.log('BUTTONS:', JSON.stringify(btns));
const add = page.locator(MAIN + ' vaadin-button, ' + MAIN + ' button').filter({ hasText: /^Добавить$/ }).first();
if (await add.count()) {
  await add.click(); await page.waitForTimeout(1500);
  const d = await page.evaluate(() => {
    const ov = document.querySelector('vaadin-dialog-overlay'); if (!ov) return null;
    return { text: ov.textContent.trim().slice(0,300),
      fields: [...ov.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-checkbox,vaadin-integer-field,vaadin-number-field,vaadin-select')]
        .map(f => f.tagName.toLowerCase()) };
  });
  console.log('NEW POSITION DIALOG:', JSON.stringify(d));
  await page.screenshot({ path: '.auth/orgstruct-position-add.png', fullPage: true });
  await page.keyboard.press('Escape'); await page.waitForTimeout(700);
}

// «Добавить штатную единицу» form (from Обзор alert, unit-scoped)
await page.locator('[role=tab]', { hasText: 'Подразделения' }).first().click();
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const t = [...document.querySelectorAll('vaadin-grid-tree-toggle')].find(x => (x.textContent||'').includes('Центральный аппарат'));
  t && t.dispatchEvent(new MouseEvent('click', { bubbles:true, composed:true }));
});
await page.waitForTimeout(1500);
console.log('=== TABS inside unit card ===',
  JSON.stringify((await page.locator(MAIN + ' [role=tab]').allInnerTexts()).filter(Boolean)));
const su = page.locator(MAIN + ' vaadin-button, ' + MAIN + ' button').filter({ hasText: /штатн/i }).first();
if (await su.count()) {
  await su.click(); await page.waitForTimeout(1600);
  const d = await page.evaluate(() => {
    const ov = document.querySelector('vaadin-dialog-overlay'); if (!ov) return null;
    return { text: ov.textContent.trim().slice(0,300),
      fields: [...ov.querySelectorAll('vaadin-text-field,vaadin-combo-box,vaadin-checkbox,vaadin-integer-field,vaadin-number-field,vaadin-select')]
        .map(f => f.tagName.toLowerCase()) };
  });
  console.log('НОВАЯ ШТАТНАЯ ЕДИНИЦА:', JSON.stringify(d));
  await page.screenshot({ path: '.auth/orgstruct-staffunit-add.png', fullPage: true });
  await page.keyboard.press('Escape');
}
await ctx.close();
