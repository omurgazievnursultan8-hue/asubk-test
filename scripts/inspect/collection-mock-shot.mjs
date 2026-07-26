// Скриншоты мокапа взыскания (модель требования: М-1/М-4/М-9/М-11). Пишет в .auth/coll/.
import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
const base = 'file://' + process.cwd() + '/mockups/collection/collection.html';
await page.goto(base + '?reset', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: '.auth/coll/list.png', fullPage: false });

// карточка солидарного дела 142: два требования по одному договору
await page.evaluate(() => openDetail('142/56/з'));
await page.waitForTimeout(300);
await page.screenshot({ path: '.auth/coll/card-req.png', fullPage: false });

for (const [i, name] of [[5, 'debt'], [6, 'mery'], [8, 'special']]) {
  await page.evaluate(n => switchTab(n), i);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `.auth/coll/tab-${name}.png`, fullPage: false });
}
// модал регистрации меры — цели
await page.evaluate(() => openMeasureModal());
await page.waitForTimeout(250);
await page.screenshot({ path: '.auth/coll/modal-measure.png', fullPage: false });
console.log('ошибок страницы:', errs.length, errs.slice(0, 5));
await ctx.close();
