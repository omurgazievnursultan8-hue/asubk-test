// probe-loan-selects2.mjs — open vaadin-selects on tab 4 and screenshot
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

// Click tab 4 (Условия кредита)
await page.evaluate(() => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  allTabs[3] && allTabs[3].click();
});
await page.waitForTimeout(2000);

// Try clicking each select by finding them via querySelector (light DOM)
const selectCount = await page.evaluate(() => {
  return document.querySelectorAll('vaadin-select').length;
});
console.log('Select count in light DOM:', selectCount);

// Try clicking a select button
await page.evaluate(() => {
  const sel = document.querySelectorAll('vaadin-select')[0];
  if (sel) {
    console.log('Found select:', sel.label, sel.value);
    // Try to open it
    const btn = sel.shadowRoot?.querySelector('button') || sel.querySelector('button');
    if (btn) btn.click();
    else sel.click();
  }
});
await page.waitForTimeout(2000);
await page.screenshot({ path: '.auth/tz-select-open.png', fullPage: false });

// Read items from overlay or list
const items = await page.evaluate(() => {
  // Check overlay
  const overlays = document.querySelectorAll('vaadin-select-overlay, vaadin-overlay');
  const results = [];
  overlays.forEach(ov => {
    const items = ov.querySelectorAll('vaadin-item, [role=option]');
    items.forEach(item => results.push({ text: item.innerText?.trim(), value: item.value }));
  });

  // Also check listboxes
  document.querySelectorAll('vaadin-list-box').forEach(lb => {
    lb.querySelectorAll('vaadin-item').forEach(item => {
      if (item.getBoundingClientRect().width > 0) {
        results.push({ text: item.innerText?.trim(), value: item.value });
      }
    });
  });

  return results;
});
console.log('SELECT ITEMS:', JSON.stringify(items, null, 2));

// Try all selects and screenshot each
const selectLabels = await page.evaluate(() => {
  return [...document.querySelectorAll('vaadin-select')]
    .filter(s => s.getBoundingClientRect().width > 0)
    .map(s => ({ label: s.label || s.getAttribute('label'), value: s.value }));
});
console.log('SELECT LABELS:', JSON.stringify(selectLabels, null, 2));

await ctx.close();
console.log('DONE');
