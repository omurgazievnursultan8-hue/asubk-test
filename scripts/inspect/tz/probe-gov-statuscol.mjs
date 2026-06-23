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
// load list WITHOUT the saved status filter
await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
// Try to clear any active filter: click "Сбросить"/reset if present
const cells = await page.evaluate(() => {
  return [...document.querySelectorAll('vaadin-grid-cell-content')].map(c => (c.textContent||'').trim()).filter(Boolean);
});
// status-like values: short Russian words seen in grid
const statusLike = [...new Set(cells)].filter(t => /^(На стадии|На рассмотрен|Одобрен|Отклон|Закрыт|Подписан|Черновик|Утвержд|Проект|Активн|Заверш)/i.test(t));
console.log('STATUS-LIKE VALUES IN GRID:', JSON.stringify(statusLike));
console.log('TOTAL CELLS:', cells.length);
await ctx.close();
