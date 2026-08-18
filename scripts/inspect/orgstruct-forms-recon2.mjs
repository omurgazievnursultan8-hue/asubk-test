/**
 * Recon 2: (a) does «Дата просмотра» accept 01.10.2025 and does the create-dialog
 * pick it up; (b) real labels of the 4 fields in «+ Подразделение»; (c) the actual
 * button name on «Типы подразделений». READ-ONLY: nothing saved.
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
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// (c) buttons on Типы подразделений
await page.locator('[role=tab]', { hasText: 'Типы' }).first().click();
await page.waitForTimeout(1500);
console.log('ТИПЫ buttons:', JSON.stringify(
  (await page.locator('vaadin-app-layout > vaadin-vertical-layout:not([slot]) vaadin-button, vaadin-app-layout > vaadin-vertical-layout:not([slot]) button').allInnerTexts()).filter(Boolean)));

await page.locator('[role=tab]', { hasText: 'Подразделения' }).first().click();
await page.waitForTimeout(1500);

// (a) date control: what is it, current value
const dateInfo = await page.evaluate(() => {
  const main = document.querySelector('vaadin-app-layout > vaadin-vertical-layout:not([slot])');
  const dps = [...main.querySelectorAll('vaadin-date-picker')];
  return dps.map(d => ({ label: d.getAttribute('label'), value: d.value, min: d.getAttribute('min'), max: d.getAttribute('max') }));
});
console.log('DATE PICKERS on page:', JSON.stringify(dateInfo));

// set to 01.10.2025 via the input + Enter
const dp = page.locator('vaadin-app-layout > vaadin-vertical-layout:not([slot]) vaadin-date-picker').first();
await dp.locator('input').fill('01.10.2025');
await dp.locator('input').press('Enter');
await page.waitForTimeout(2500);
const after = await page.evaluate(() => {
  const main = document.querySelector('vaadin-app-layout > vaadin-vertical-layout:not([slot])');
  const d = main.querySelector('vaadin-date-picker');
  return { value: d.value, invalid: d.hasAttribute('invalid') };
});
console.log('DATE AFTER SET:', JSON.stringify(after));
await page.screenshot({ path: '.auth/orgstruct-recon2-date-2025.png', fullPage: true });
console.log('MAIN TEXT @01.10.2025:\n' + (await page.locator('vaadin-app-layout > vaadin-vertical-layout:not([slot])').first().innerText()).slice(0, 1500));

// (b) open create dialog at that date, dump labels properly
await page.locator('vaadin-button, button').filter({ hasText: '+ Подразделение' }).first().click();
await page.waitForTimeout(1800);
const form = await page.evaluate(() => {
  const ov = document.querySelector('vaadin-dialog-overlay'); if (!ov) return null;
  const walk = (root, out) => {
    root.querySelectorAll('*').forEach(el => {
      const t = el.tagName.toLowerCase();
      if (/^vaadin-(text-field|combo-box|select|date-picker|integer-field|number-field|checkbox|text-area)$/.test(t)) {
        const lbl = el.querySelector('label')?.textContent?.trim()
          || el.getAttribute('label')
          || el.shadowRoot?.querySelector('[part=label]')?.textContent?.trim() || '';
        out.push({ tag: t, label: lbl, required: el.hasAttribute('required'), value: el.value ?? null,
                   placeholder: el.getAttribute('placeholder') });
      }
      if (el.shadowRoot) walk(el.shadowRoot, out);
    });
  };
  const out = []; walk(ov, out);
  return { title: ov.textContent.trim().slice(0, 200), fields: out };
});
console.log('CREATE FORM @01.10.2025:', JSON.stringify(form, null, 1));
await page.screenshot({ path: '.auth/orgstruct-recon2-create-2025.png', fullPage: true });

// combo options
for (let i = 0; i < 3; i++) {
  const opts = await page.evaluate((idx) => {
    const ov = document.querySelector('vaadin-dialog-overlay');
    const cbs = [...ov.querySelectorAll('vaadin-combo-box')];
    const cb = cbs[idx]; if (!cb) return null;
    const items = cb.items || cb.filteredItems || [];
    return items.slice(0, 40).map(x => typeof x === 'string' ? x : (x.label || x.name || JSON.stringify(x).slice(0,80)));
  }, i);
  console.log(`COMBO[${i}] items:`, JSON.stringify(opts));
}
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await ctx.close();
