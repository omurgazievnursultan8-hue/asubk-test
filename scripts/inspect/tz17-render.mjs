// Проверка рендера раздела ТЗ 17 (классификация) в настоящем браузере:
// заголовки, живые якоря оглавления, ошибки страницы, снимок раздела 8.
import { chromium } from 'playwright-core';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1400, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('file://' + process.cwd() + '/requirements/tz/17-klassifikatsiya.html', { waitUntil: 'load' });
const r = await page.evaluate(() => {
  const ids = new Set([...document.querySelectorAll('[id]')].map(e => e.id));
  const nav = [...document.querySelectorAll('nav a')].map(a => a.getAttribute('href').slice(1));
  const heads = [...document.querySelectorAll('main h2[id], main h3[id]')].map(h => h.id);
  return {
    title: document.title,
    kick: document.querySelector('header .kick').textContent.trim(),
    h2: document.querySelectorAll('main h2').length,
    h3: document.querySelectorAll('main h3').length,
    navLinks: nav.length,
    deadNav: nav.filter(id => !ids.has(id)),
    headsNotInNav: heads.filter(id => !nav.includes(id)),
    s8: [...document.querySelectorAll('#s8 ~ h3')].map(h => h.textContent.trim()).filter(t => t.startsWith('8.')),
    invariants: [...document.querySelectorAll('#s12 ~ table tbody tr td:first-child')]
      .map(td => td.textContent.trim()).filter(t => t.startsWith('ИК-')).length,
    tasks: [...document.querySelectorAll('#s15 ~ table td')].map(td => td.textContent.trim())
      .filter(t => /^P19-R\d+$/.test(t)).length,
  };
});
await page.locator('#s8').scrollIntoViewIfNeeded();
await page.screenshot({ path: '.auth/tz17-s8.png' });
console.log(JSON.stringify(r, null, 1));
console.log('page errors:', errs.length, errs.slice(0, 3));
await ctx.close();
