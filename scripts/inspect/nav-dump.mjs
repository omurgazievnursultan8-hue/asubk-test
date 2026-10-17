// Дамп полного левого меню приложения: группы -> пункты (текст + route).
// Нужен как доказательная база для матрицы «требование ТЗ -> есть/нет в приложении».
// Запуск: node scripts/inspect/nav-dump.mjs  (пишет .auth/nav-dump.json и печатает дерево)
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1200 },
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
console.log('URL:', page.url());

// Раскрыть все свёрнутые группы меню (Jmix/Vaadin рисует их как details/summary или li с кликом).
const openers = await page.$$('vaadin-side-nav-item[has-children], vaadin-details summary, .jmix-menubar-item, li[role=treeitem]');
for (const el of openers) {
  try { await el.click({ timeout: 800 }); await page.waitForTimeout(120); } catch {}
}
await page.waitForTimeout(1200);

const tree = await page.evaluate(() => {
  const seen = new Set();
  const out = [];
  const walk = (root) => {
    const nodes = root.querySelectorAll('a[href], vaadin-side-nav-item, [role=treeitem], [role=menuitem]');
    for (const n of nodes) {
      const text = (n.textContent || '').replace(/\s+/g, ' ').trim();
      const href = n.getAttribute('href') || n.getAttribute('path') || '';
      if (!text || text.length > 120) continue;
      const key = text + '|' + href;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text, href });
    }
    // пройти по shadow-корням (Vaadin)
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  return out;
});

writeFileSync('.auth/nav-dump.json', JSON.stringify(tree, null, 2));
console.log('items:', tree.length);
for (const it of tree) console.log(`${it.text}\t${it.href}`);
await page.screenshot({ path: '.auth/nav-dump.png', fullPage: true });
await ctx.close();
