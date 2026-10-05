// What role machinery actually exists: Jmix resource roles vs the app's own «Роли доступа».
// Dumps the role registries and opens one role to see what a permission row looks like.
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
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
const grab = async (r, n = 40) => {
  await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const o = await page.evaluate((n) => {
    const cells = [...document.querySelectorAll('vaadin-grid-cell-content')]
      .map(e => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean);
    const rows = (document.body.innerText.match(/\d+\s+стро\S*/) || [''])[0];
    return { title: document.title, rows, cells: cells.slice(0, n) };
  }, n);
  console.log(`\n=== ${r} | «${o.title}» | ${o.rows}\n${o.cells.join(' · ')}`);
  return o;
};
await grab('sec/resourcerolemodels', 60);
await grab('access-roles', 40);
await grab('users', 30);
await grab('sec/rowlevelrolemodels', 20);
await ctx.close();
