// «Роли доступа» detail — is this where menu visibility is actually configured?
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
await page.goto(BASE + 'access-roles', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
await page.locator('vaadin-grid-cell-content').filter({ hasText: 'Пользователь "Просмотр"' }).first()
  .dblclick({ timeout: 8000 }).catch(e => console.log('dblclick:', e.message));
await page.waitForTimeout(3000);
const o = await page.evaluate(() => {
  const drawer = document.querySelector('vaadin-app-layout [slot=drawer]');
  const out = el => !drawer || !drawer.contains(el);
  const q = s => [...document.querySelectorAll(s)].filter(out);
  return {
    url: location.pathname, title: document.title,
    tabs: q('vaadin-tab').map(e => (e.innerText || '').trim()),
    fields: q('vaadin-text-field,vaadin-combo-box,vaadin-checkbox,vaadin-select,vaadin-multi-select-combo-box')
      .map(e => (e.getAttribute('label') || e.innerText || '').trim()).filter(Boolean).slice(0, 25),
    trees: q('vaadin-tree-grid').length,
    cells: q('vaadin-grid-cell-content').map(e => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 60),
    text: q('vaadin-vertical-layout').map(e => (e.innerText || '').trim()).sort((a, b) => b.length - a.length)[0]?.slice(0, 900) || '',
  };
});
console.log('URL', o.url, '|', o.title);
console.log('ВКЛАДКИ:', o.tabs.join(' | ') || '—');
console.log('ПОЛЯ:', o.fields.join(' | ') || '—');
console.log('tree-grid:', o.trees);
console.log('СЕТКА:', o.cells.join(' · ') || '—');
console.log('ТЕКСТ:\n', o.text);
await page.screenshot({ path: '.auth/access-role-detail.png' });
await ctx.close();
