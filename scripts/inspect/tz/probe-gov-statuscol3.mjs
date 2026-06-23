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

// Find the vaadin-details-summary for the filter and inspect its structure
const filterSummary = await page.$('vaadin-details-summary');
if (filterSummary) {
  const html = await filterSummary.evaluate(e => e.outerHTML);
  console.log('FILTER SUMMARY HTML:', html.substring(0, 500));

  // Click to expand it if not expanded
  await filterSummary.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.auth/statuscol-filter-expanded.png' });

  // Look for the filter details content
  const filterDetails = await page.$('vaadin-details');
  if (filterDetails) {
    const detailsHTML = await filterDetails.evaluate(e => e.outerHTML);
    console.log('FILTER DETAILS HTML (first 2000):', detailsHTML.substring(0, 2000));
  }
}

// Look for any "сбросить" or reset button in the filter area
const resetBtns = await page.$$('vaadin-button');
for (const btn of resetBtns) {
  const text = await btn.textContent().catch(() => '').then(t => t.trim());
  console.log('BTN:', JSON.stringify(text));
}

// Look at the full page HTML around the filter section
const fullHTML = await page.evaluate(() => {
  const el = document.querySelector('vaadin-details, [class*="filter"]');
  return el ? el.outerHTML.substring(0, 3000) : 'NOT FOUND';
});
console.log('FULL FILTER ELEMENT:', fullHTML);

await ctx.close();
