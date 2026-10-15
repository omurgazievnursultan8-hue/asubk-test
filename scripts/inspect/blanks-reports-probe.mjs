// Модуль «Отчеты» (Jmix Reports) на новом стенде: открывается ли, текст ошибки, состав.
// Каждый маршрут — с главной страницы, при ошибке раскрывает «Подробности >>».
//   node scripts/inspect/blanks-reports-probe.mjs [route ...]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const OUT = '.auth/blanks';
mkdirSync(OUT, { recursive: true });
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2)
  : ['reports', 'reports/groups', 'reports/run', 'reports/tables'];

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1920, height: 1080 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const login = async () => {
  if (page.url().includes('/login')) {
    await page.fill('input[name=username]', USER);
    await page.fill('input[name=password]', PASS);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
      page.keyboard.press('Enter'),
    ]);
    await page.waitForTimeout(2500);
  }
};
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await login();

for (const r of ROUTES) {
  const key = r.replace(/\//g, '_');
  console.log(`\n==================== ${r} ====================`);
  await page.goto(BASE + 'gov-decisions', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);
  // переход через пункт меню, а не по URL — как пользователь
  const link = await page.$(`vaadin-side-nav-item[path="${r}"]`);
  if (link) { await link.evaluate(e => e.click()); } else { await page.goto(BASE + r, { waitUntil: 'networkidle' }); }
  await page.waitForTimeout(3000);
  console.log('URL:', page.url(), link ? '(через меню)' : '(по URL)');
  const det = await page.$('vaadin-button:has-text("Подробности")');
  if (det) {
    await det.click(); await page.waitForTimeout(800);
    const t = await page.evaluate(() => [...document.querySelectorAll('vaadin-dialog-overlay, vaadin-notification-card, vaadin-confirm-dialog-overlay')].map(o => o.innerText).join('\n---\n'));
    console.log('ERROR DIALOG:\n' + t.slice(0, 3000));
    const ta = await page.evaluate(() => [...document.querySelectorAll('vaadin-text-area, textarea')].map(x => x.value).join('\n---\n'));
    console.log('STACK:\n' + ta.slice(0, 3000));
    await page.screenshot({ path: `${OUT}/${key}-error.png` });
    const close = await page.$('vaadin-button:has-text("Закрыть")');
    if (close) await close.click().catch(() => {});
    await page.waitForTimeout(800);
  }
  const txt = await page.evaluate(() => {
    const d = document.querySelector('[slot=drawer]');
    const t = document.body.innerText;
    return d ? t.replace(d.innerText, '') : t;
  });
  console.log('TEXT:\n' + txt.slice(0, 4000));
  await page.screenshot({ path: `${OUT}/${key}-page.png`, fullPage: true });
}
await ctx.close();
