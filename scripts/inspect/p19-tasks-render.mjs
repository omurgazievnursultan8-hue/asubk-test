// Разовая проверка рендера постановки P19 в настоящем браузере.
import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1500, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('file://' + process.cwd() + '/docs/tasks/p19-klassifikatsiya-tasks.html', { waitUntil: 'load' });
await page.waitForTimeout(400);
const r = await page.evaluate(() => ({
  title: document.title,
  h1: document.getElementById('hero-title').textContent.trim(),
  cards: document.querySelectorAll('.card').length,
  tiles: [...document.querySelectorAll('.tile')].map(t => t.textContent.trim()),
  stages: document.getElementById('fStage').options.length,
  idmap: !!document.getElementById('panel-idmap'),
  atlas: document.querySelectorAll('#atlas-list .ent').length,
  screens: document.querySelectorAll('#screens-list .scr').length,
  gloss: document.querySelectorAll('#gloss-list .gloss > div').length,
  walk: document.querySelectorAll('#walk-list .guide-item').length,
  count: document.getElementById('count').textContent.trim(),
  firstCard: document.querySelector('.card h2') ? document.querySelector('.card h2').textContent.trim() : null,
  lead: document.getElementById('hero-lead').textContent.trim().slice(0, 90),
}));
await page.fill('#q', 'фиксац');
await page.waitForTimeout(200);
r.searchHits = await page.evaluate(() => document.querySelectorAll('.card').length);
await page.click('#reset'); await page.waitForTimeout(150);
r.afterReset = await page.evaluate(() => document.querySelectorAll('.card').length);
console.log(JSON.stringify(r, null, 1));
console.log('page errors:', errs.length, errs.slice(0, 3));
await ctx.close();
