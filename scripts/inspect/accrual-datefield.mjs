// Probe the «Дата расчета» field on the «Детальный расчет» tab.
import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const REC = process.env.REC || '18';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1900, height: 1100 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + `loan-credits/${REC}`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3500);
for (const t of await page.$$('vaadin-tab')) if (/Детальн/.test(await t.textContent())) { await t.click({force:true}); break; }
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => {
  return [...document.querySelectorAll('vaadin-date-picker')].map((el, i) => {
    const r = el.getBoundingClientRect();
    return { i, vis: r.width > 0 && r.height > 0, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width)],
      label: el.getAttribute('label'), labelSlot: el.querySelector('label')?.textContent?.trim(),
      id: el.id, value: el.value, cls: el.className };
  });
}), null, 1));
await ctx.close();
