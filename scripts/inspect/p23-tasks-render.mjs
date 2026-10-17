// Проверка рендера постановки P23 в настоящем браузере: ошибки JS, число карточек и этапов,
// чип редакции, журнал редакции, свод, новые карточки P23-R38…P23-R49 и врезки «Решения нет».
//   node scripts/inspect/p23-tasks-render.mjs
//   PW_CHROMIUM=/opt/pw-browsers/chromium node scripts/inspect/p23-tasks-render.mjs   # без системного Chrome
import { chromium } from 'playwright-core';

const exe = process.env.PW_CHROMIUM;
const browser = await chromium.launch(exe ? { executablePath: exe, headless: true } : { channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('file://' + process.cwd() + '/docs/tasks/p23-otchetnost-tasks.html', { waitUntil: 'load' });
await page.waitForTimeout(500);
const r = await page.evaluate(() => {
  const body = document.body.textContent; // свод свёрнут — innerText его не видит
  const ids = [...document.querySelectorAll('.card')].map(c => c.dataset.id);
  const fresh = Array.from({ length: 12 }, (_, i) => 'P23-R' + (38 + i));
  return {
    title: document.title,
    cards: ids.length,
    groups: document.querySelectorAll('.group').length,
    revbar: document.getElementById('revbar')?.textContent.replace(/\s+/g, ' ').trim(),
    journal: body.includes('Журнал редакции 3'),
    freshMissing: fresh.filter(id => !ids.includes(id)),
    dupIds: ids.filter((id, i) => ids.indexOf(id) !== i),
    atlas: document.getElementById('atlas-cnt')?.textContent,
    screens: document.getElementById('screens-cnt')?.textContent,
    gloss: document.getElementById('gloss-cnt')?.textContent,
    openq: document.getElementById('openq-cnt')?.textContent,
    count: document.getElementById('count')?.textContent.trim(),
  };
});
console.log(JSON.stringify(r, null, 1));
console.log('errors:', errs.length ? errs : 'none');
const card = page.locator('.card', { hasText: 'P23-R48' }).first();
await card.scrollIntoViewIfNeeded();
await card.screenshot({ path: '.auth/p23-r48-card.png' }).catch(() => {});
await browser.close();
if (errs.length || r.cards !== 49 || r.freshMissing.length || r.dupIds.length) process.exit(1);
