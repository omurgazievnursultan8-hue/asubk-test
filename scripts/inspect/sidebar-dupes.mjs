// Are the sidebar's look-alike pairs actually different screens?
// For each route: page title, grid column headers, row-count footer.
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ROUTES = [
  'collateral-monitoring', 'loan-collateral-monitoring',
  'loan-redemption-accounts', 'payment-accounts', 'loan-type-repayment-accounts', 'payment-purpose-requisites',
  'interest-rates', 'loan-percent-rates', 'floating-rates',
  'employees', 'employee-info', 'departments', 'org-structure-mgmt',
  'loan-guarantee-collaterals', 'loan-collateral-items',
  'creditTerms', 'loan-termses',
];
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', process.env.OK_USER || 'admin');
  await page.fill('input[name=password]', process.env.OK_PASS || 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(4000);
}
for (const r of ROUTES) {
  await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1600);
  const info = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('vaadin-grid-cell-content')]
      .map(e => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean);
    const rows = (document.body.innerText.match(/\d+\s+стро\S*/) || [''])[0];
    return { title: document.title, heads: heads.slice(0, 14), rows };
  });
  console.log(`${r}  |  «${info.title}»  |  ${info.rows}\n   cols: ${info.heads.join(' · ')}`);
}
await ctx.close();
