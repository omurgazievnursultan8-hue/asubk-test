/**
 * Recon before loading real structure: what fields do «+ Подразделение» and
 * «Типы подразделений → Добавить» expose, and does the unit form accept a past date.
 * READ-ONLY: opens dialogs, dumps fields, closes without saving.
 * Run: node scripts/inspect/orgstruct-forms-recon.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1680, height: 1050 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

const dumpDialog = async (tag) => {
  const d = await page.evaluate(() => {
    const ov = document.querySelector('vaadin-dialog-overlay');
    if (!ov) return null;
    const fields = [];
    ov.querySelectorAll('vaadin-text-field, vaadin-date-picker, vaadin-combo-box, vaadin-select, vaadin-integer-field, vaadin-number-field, vaadin-checkbox, vaadin-text-area').forEach(f => {
      fields.push({
        tag: f.tagName.toLowerCase(),
        label: f.getAttribute('label') || f.textContent?.trim().slice(0, 40) || '',
        required: f.hasAttribute('required'),
        value: f.value ?? null,
        min: f.getAttribute('min'), max: f.getAttribute('max'),
      });
    });
    const btns = [...ov.querySelectorAll('vaadin-button, button')].map(b => b.textContent.trim()).filter(Boolean);
    return { title: (ov.querySelector('[slot=title]')?.textContent || '').trim(), fields, btns };
  });
  console.log(`\n===== ${tag} =====`);
  console.log(d ? JSON.stringify(d, null, 1) : '(no dialog opened)');
  return d;
};
const closeDialog = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(800); };

// --- Типы подразделений → Добавить ---
await page.locator('[role=tab]', { hasText: 'Типы' }).first().click();
await page.waitForTimeout(1200);
await page.locator('vaadin-button, button').filter({ hasText: /^Добавить$/ }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await dumpDialog('ТИПЫ → Добавить');
await page.screenshot({ path: '.auth/orgstruct-recon-type-add.png', fullPage: true });
await closeDialog();

// --- Подразделения → + Подразделение ---
await page.locator('[role=tab]', { hasText: 'Подразделения' }).first().click();
await page.waitForTimeout(1200);
await page.locator('vaadin-button, button').filter({ hasText: '+ Подразделение' }).first().click().catch(() => {});
await page.waitForTimeout(1800);
const unitForm = await dumpDialog('ПОДРАЗДЕЛЕНИЯ → + Подразделение');
await page.screenshot({ path: '.auth/orgstruct-recon-unit-add.png', fullPage: true });

// probe: does the creation-date field accept a past date (01.10.2025)?
if (unitForm) {
  const res = await page.evaluate(() => {
    const ov = document.querySelector('vaadin-dialog-overlay');
    const dp = ov?.querySelector('vaadin-date-picker');
    if (!dp) return 'no date-picker in form';
    const inp = dp.querySelector('input');
    inp.value = '01.10.2025';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return 'typed 01.10.2025 into ' + (dp.getAttribute('label') || 'date field');
  });
  console.log('\nPAST-DATE PROBE:', res);
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => {
    const ov = document.querySelector('vaadin-dialog-overlay');
    const dp = ov?.querySelector('vaadin-date-picker');
    return dp ? { value: dp.value, invalid: dp.hasAttribute('invalid'), err: dp.getAttribute('error-message') } : null;
  });
  console.log('AFTER:', JSON.stringify(after));
  await page.screenshot({ path: '.auth/orgstruct-recon-pastdate.png', fullPage: true });
}
await closeDialog();

// --- Штатное расписание → Добавить единицу (fields only) ---
await page.evaluate(() => {
  const t = [...document.querySelectorAll('vaadin-grid-tree-toggle')].find(x => (x.textContent || '').includes('Центральный аппарат'));
  t && t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
});
await page.waitForTimeout(1200);
await page.locator('[role=tab]', { hasText: 'Штатное расписание' }).first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.locator('vaadin-button, button').filter({ hasText: 'Добавить единицу' }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await dumpDialog('ШТАТ → Добавить единицу');
await page.screenshot({ path: '.auth/orgstruct-recon-pos-add.png', fullPage: true });
await closeDialog();

await ctx.close();
