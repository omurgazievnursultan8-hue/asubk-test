// scripts/inspect/tz/probe-disbursement-selects.mjs
// Opens disbursement detail record 2 (via list click), probes the select dropdowns.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 1200 },
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

await page.goto(BASE + 'disbursements', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Double-click first grid row to open
await page.evaluate(() => {
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')]
    .filter(c => c.getBoundingClientRect().width > 0 && /\d/.test(c.innerText || ''));
  if (cells[0]) cells[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
});
await page.waitForTimeout(2000);

// If nothing opened, try clicking row then Изменить
if (!page.url().includes('disbursements/')) {
  await page.evaluate(() => {
    const cells = [...document.querySelectorAll('vaadin-grid-cell-content')]
      .filter(c => c.getBoundingClientRect().width > 0 && /\d/.test(c.innerText || ''));
    if (cells[0]) cells[0].click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('vaadin-button')]
      .find(b => b.getBoundingClientRect().width > 0 && b.innerText.trim() === 'Изменить');
    if (btn) btn.click();
  });
  await page.waitForTimeout(2500);
}

console.log('URL:', page.url());

// Open Периодичность платежей
await page.evaluate(() => {
  const selects = [...document.querySelectorAll('vaadin-select')]
    .filter(s => s.getBoundingClientRect().width > 0 && (s.label || '').includes('Периодичность'));
  if (selects[0]) selects[0].click();
});
await page.waitForTimeout(1200);

const periodicityItems = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-select-item, vaadin-item')]
    .filter(i => i.getBoundingClientRect().width > 0)
    .map(i => ({ value: i.value || i.getAttribute('value'), text: i.innerText?.trim() }))
);
console.log('Disbursement Периодичность OPTIONS:', JSON.stringify(periodicityItems));

await ctx.close();
console.log('=== DONE ===');
