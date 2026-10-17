// Проверка рендера постановки P23 в настоящем браузере: ошибки JS, число карточек,
// справка «Движок вывода бланков», карточка P23-R33 и врезки «Решения нет».
//   node scripts/inspect/p23-tasks-render.mjs
import { chromium } from 'playwright-core';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1920, height: 1080 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('file://' + process.cwd() + '/docs/tasks/p23-otchetnost-tasks.html', { waitUntil: 'load' });
await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  const body = document.body.textContent; // справка свёрнута — innerText её не видит
  const card = [...document.querySelectorAll('.card')].find(c => c.textContent.includes('P23-R33'));
  return {
    cards: document.querySelectorAll('.card').length,
    revbar: document.getElementById('revbar')?.textContent.replace(/\s+/g, ' ').trim(),
    engineGuide: body.includes('Движок вывода бланков'),
    glossEngine: body.includes('движок вывода'),
    r33: !!card,
    r33text: card ? card.innerText.slice(0, 400) : null,
    defects: [...document.querySelectorAll('.defect')].map(d => d.textContent.trim()),
    count: document.getElementById('count')?.textContent.trim(),
  };
});
console.log(JSON.stringify(r, null, 1));
console.log('errors:', errs.length ? errs : 'none');
const card = page.locator('.card', { hasText: 'P23-R33' }).first();
await card.scrollIntoViewIfNeeded();
await card.screenshot({ path: '.auth/p23-r33-card.png' });
await ctx.close();
