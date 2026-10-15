// Разведка: есть ли на новом стенде экран настройки бланков / шаблонов печати.
// Логин, обход бокового меню (раскрывает группы), вывод всех пунктов со ссылками.
//   node scripts/inspect/blanks-menu-probe.mjs
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1920, height: 1080 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2500);
}
// раскрыть все свёрнутые группы меню
for (let i = 0; i < 4; i++) {
  const closed = await page.$$('vaadin-details:not([opened]), vaadin-side-nav-item[has-children]:not([expanded])');
  for (const el of closed) { await el.evaluate(e => { e.opened = true; e.expanded = true; }).catch(() => {}); }
  await page.waitForTimeout(400);
}
const items = await page.evaluate(() => {
  const out = [];
  const walk = (root) => {
    root.querySelectorAll('a[href], vaadin-side-nav-item, vaadin-menu-bar-item, vaadin-details-summary, [role=menuitem]').forEach(e => {
      const t = (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ');
      const h = e.getAttribute('href') || e.getAttribute('path') || '';
      if (t) out.push(`${t} | ${h}`);
    });
    root.querySelectorAll('*').forEach(e => e.shadowRoot && walk(e.shadowRoot));
  };
  walk(document);
  return [...new Set(out)];
});
console.log('URL:', page.url());
items.forEach(s => console.log(s));
await page.screenshot({ path: '.auth/blanks-menu.png', fullPage: true });
await ctx.close();
