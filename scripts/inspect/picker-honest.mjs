import { chromium } from 'playwright-core';
const BASE = 'https://fkftest.okmot.kg/';
const ctx = await chromium.launchPersistentContext('.auth/profile', { channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1700, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin'); await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }).catch(()=>{}), page.keyboard.press('Enter')]); await page.waitForTimeout(2500);
}
await page.goto(BASE + 'loan-programs/new', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.locator('#govDecisionField #entityLookupAction').click({ timeout: 5000 });
await page.waitForTimeout(2500);

const res = await page.evaluate(async () => {
  const ov = [...document.querySelectorAll('vaadin-dialog-overlay')].pop();
  const grid = ov.querySelector('vaadin-grid');
  // force lazy-load the full dataset: jump to a huge index, then settle
  for (const idx of [50, 100, 200]) { grid.scrollToIndex(idx); await new Promise(r=>setTimeout(r,300)); }
  const realSize = grid._effectiveSize ?? grid.size ?? null;
  // now walk every index, collect FIRST-column (Наименование) + scan all cells for statuses
  const names = new Set(); const statuses = new Set();
  for (let i = 0; i <= (realSize||0); i++) {
    grid.scrollToIndex(i); await new Promise(r=>setTimeout(r,60));
    for (const c of grid.querySelectorAll('vaadin-grid-cell-content')) {
      const t = c.textContent.trim(); if (!t) continue;
      if (/^(Одобрен|На стадии рассмотрения|Закрыт|Отклонен|Черновик)$/.test(t)) statuses.add(t);
      names.add(t);
    }
  }
  return { realSize, statuses:[...statuses], hasZZZ:[...names].some(n=>n.includes('ZZZ ТЕСТ')), allNames:[...names].filter(n=>n.length>4).slice(0,60) };
});
log('PICKER realSize:', res.realSize);
log('PICKER statuses present:', JSON.stringify(res.statuses));
log('PICKER has ZZZ under-review record?', res.hasZZZ);
log('PICKER names sample:', JSON.stringify(res.allNames));
await page.screenshot({ path: '.auth/picker-honest.png', fullPage: true });
await ctx.close();
