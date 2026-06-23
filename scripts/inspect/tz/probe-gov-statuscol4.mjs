import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2000);
}

// load gov-decisions list
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

// Get full page HTML to find the filter chip
const bodyHTML = await page.evaluate(() => document.body.innerHTML);
// Find the filter chip section - search for "фильтр по статусу"
const idx = bodyHTML.toLowerCase().indexOf('фильтр по статусу');
if (idx >= 0) {
  console.log('FILTER CHIP CONTEXT (surrounding HTML):', bodyHTML.substring(Math.max(0, idx-200), idx+500));
}

// Also check what's in the grid status column
// Get all grid rows and their status column value
const statusColValues = await page.evaluate(() => {
  const grid = document.querySelector('vaadin-grid');
  if (!grid) return { error: 'no grid' };

  // Get all cell contents
  const cells = [...document.querySelectorAll('vaadin-grid-cell-content')];
  return cells.map(c => c.textContent?.trim()).filter(Boolean);
});
console.log('ALL GRID CELL CONTENTS:', JSON.stringify(statusColValues.slice(0, 100)));

// Try to find the Jmix filter that has "фильтр по статусу"
// Jmix generic filter component
const jmixFilter = await page.$('jmix-generic-filter');
if (jmixFilter) {
  const html = await jmixFilter.evaluate(e => e.outerHTML.substring(0, 3000));
  console.log('JMIX GENERIC FILTER HTML:', html);
}

// find by text content
const allText = await page.evaluate(() => {
  return [...document.querySelectorAll('*')].map(e => ({
    tag: e.tagName,
    text: e.textContent?.trim().substring(0, 100),
    class: e.className?.substring ? e.className.substring(0, 100) : ''
  })).filter(e => e.text && e.text.toLowerCase().includes('фильтр по статусу') && e.text.length < 200);
});
console.log('ELEMENTS WITH "фильтр по статусу":', JSON.stringify(allText.slice(0, 10)));

await ctx.close();
