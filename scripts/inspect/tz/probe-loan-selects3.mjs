// probe-loan-selects3.mjs — get all vaadin-select options from tab 4
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

// Click tab 4
await page.evaluate(() => {
  const allTabs = [...document.querySelectorAll('vaadin-tab')].filter(t => t.getBoundingClientRect().width > 0);
  allTabs[3] && allTabs[3].click();
});
await page.waitForTimeout(2000);

// Get all selects
const selects = await page.evaluate(() => {
  return [...document.querySelectorAll('vaadin-select')]
    .filter(s => s.getBoundingClientRect().width > 0)
    .map(s => ({ label: s.label || s.getAttribute('label'), value: s.value, idx: [...document.querySelectorAll('vaadin-select')].indexOf(s) }));
});

const results = [];
for (const sel of selects) {
  // Click to open
  await page.evaluate((label) => {
    const s = [...document.querySelectorAll('vaadin-select')]
      .find(s => (s.label || s.getAttribute('label')) === label);
    if (s) s.click();
  }, sel.label);
  await page.waitForTimeout(1500);

  const items = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('vaadin-item, [role=option]').forEach(item => {
      const r = item.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        results.push({ text: item.innerText?.trim(), value: item.value || item.getAttribute('value') });
      }
    });
    return results;
  });
  results.push({ label: sel.label, currentValue: sel.value, items });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

console.log('ALL SELECT OPTIONS:', JSON.stringify(results, null, 2));

await ctx.close();
console.log('DONE');
