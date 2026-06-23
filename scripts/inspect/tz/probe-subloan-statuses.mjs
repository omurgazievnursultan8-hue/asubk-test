// scripts/inspect/tz/probe-subloan-statuses.mjs
// Opens tranche detail, goes to Условия tab, opens the Статус select to get all options.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

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

await page.goto(BASE + 'sub-loans/1', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Click tab 2 (Условия)
await page.evaluate(() => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  if (allTabs[1]) allTabs[1].click();
});
await page.waitForTimeout(2000);

// Click the Статус vaadin-select to open it
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')]
    .filter(s => s.getBoundingClientRect().width > 0);
  for (const s of selects) {
    const l = s.label || s.getAttribute('label');
    if (l && l.includes('Статус')) {
      s.click();
      return;
    }
  }
  // fallback: click first select
  if (selects[0]) selects[0].click();
});
await page.waitForTimeout(1500);

// Get options
const options = await page.evaluate(() => {
  // vaadin-select overlays items
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')]
    .filter(i => i.getBoundingClientRect().width > 0)
    .map(i => ({ value: i.value || i.getAttribute('value'), text: i.innerText?.trim() }));
  return items;
});

console.log('STATUS OPTIONS:', JSON.stringify(options, null, 2));

// Also probe Периодичность платежа
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')]
    .filter(s => s.getBoundingClientRect().width > 0);
  for (const s of selects) {
    const l = s.label || s.getAttribute('label');
    if (l && l.includes('Периодичность')) {
      s.click();
      return;
    }
  }
});
await page.waitForTimeout(1500);

const periodicityOpts = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')]
    .filter(i => i.getBoundingClientRect().width > 0)
    .map(i => ({ value: i.value || i.getAttribute('value'), text: i.innerText?.trim() }));
  return items;
});
console.log('PERIODICITY OPTIONS:', JSON.stringify(periodicityOpts, null, 2));

// Обработка выходных
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')]
    .filter(s => s.getBoundingClientRect().width > 0);
  for (const s of selects) {
    const l = s.label || s.getAttribute('label');
    if (l && l.includes('Обработка')) {
      s.click();
      return;
    }
  }
});
await page.waitForTimeout(1500);

const weekendOpts = await page.evaluate(() => {
  const items = [...document.querySelectorAll('vaadin-select-item, vaadin-item')]
    .filter(i => i.getBoundingClientRect().width > 0)
    .map(i => ({ value: i.value || i.getAttribute('value'), text: i.innerText?.trim() }));
  return items;
});
console.log('WEEKEND HANDLING OPTIONS:', JSON.stringify(weekendOpts, null, 2));

await page.screenshot({ path: '.auth/tz-subloan-statuses.png', fullPage: true });
await ctx.close();
console.log('=== DONE ===');
