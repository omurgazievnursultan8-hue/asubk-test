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

// The filter is a jmix-generic-filter vaadin-details
// Let's click the summary to expand/inspect it, then look for a clear button inside
const filterDetails = await page.$('.jmix-generic-filter');
if (filterDetails) {
  // Get the full HTML of the filter
  const html = await filterDetails.evaluate(e => e.outerHTML);
  console.log('FILTER HTML (first 3000):', html.substring(0, 3000));
}

// Click the filter summary to expand/toggle it
const filterSummary = await page.$('.jmix-generic-filter vaadin-details-summary');
if (filterSummary) {
  await filterSummary.click();
  await page.waitForTimeout(1500);

  // Now look inside expanded filter
  const filterDetails2 = await page.$('.jmix-generic-filter');
  const html2 = await filterDetails2.evaluate(e => e.outerHTML);
  console.log('FILTER HTML AFTER CLICK (first 5000):', html2.substring(0, 5000));

  await page.screenshot({ path: '.auth/statuscol-filter-clicked.png' });
}

// Look for the Обновить button which is in the filter area (based on grid text)
const allButtons = await page.$$('vaadin-button');
for (const btn of allButtons) {
  const text = await btn.textContent().catch(() => '').then(t => t.trim());
  const id = await btn.getAttribute('id').catch(() => '');
  console.log('BTN:', JSON.stringify(text), 'id:', id);
}

await ctx.close();
