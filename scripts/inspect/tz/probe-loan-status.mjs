// probe-loan-status.mjs — read Статус кредита enum from live record 18
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const USER = 'admin'; const PASS = 'admin';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1100 },
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
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-credits/18', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Click the Статус кредита combo box to open it
await page.evaluate(() => {
  const combo = [...document.querySelectorAll('vaadin-combo-box')]
    .find(c => (c.getAttribute('label') || '').includes('Статус кредита'));
  if (combo) {
    combo.click();
    combo.open = true;
  }
});
await page.waitForTimeout(2000);

// Read items from the opened dropdown
const dropdownItems = await page.evaluate(() => {
  const results = [];
  // Try overlay items
  document.querySelectorAll('vaadin-combo-box-item').forEach(item => {
    results.push(item.innerText?.trim());
  });
  // Also try option roles
  document.querySelectorAll('[role=option]').forEach(item => {
    results.push(item.innerText?.trim());
  });
  // Also check combo.items directly
  const combo = [...document.querySelectorAll('vaadin-combo-box')]
    .find(c => (c.getAttribute('label') || '').includes('Статус кредита'));
  if (combo && combo.items) {
    results.push(...combo.items.map(i => typeof i === 'object' ? (i.label || i.caption || JSON.stringify(i)) : String(i)));
  }
  return [...new Set(results.filter(Boolean))];
});
console.log('STATUS DROPDOWN ITEMS:', JSON.stringify(dropdownItems, null, 2));

// Get the current value
const currentStatus = await page.evaluate(() => {
  const combo = [...document.querySelectorAll('vaadin-combo-box')]
    .find(c => (c.getAttribute('label') || '').includes('Статус кредита'));
  if (!combo) return null;
  return {
    value: combo.value,
    selectedItem: combo.selectedItem ? JSON.stringify(combo.selectedItem) : null,
    items: (combo.items || []).map(i => typeof i === 'object' ? JSON.stringify(i) : String(i))
  };
});
console.log('CURRENT STATUS VALUE:', JSON.stringify(currentStatus, null, 2));

await page.screenshot({ path: '.auth/tz-loan-status-dropdown.png', fullPage: true });
await ctx.close();
console.log('DONE');
