/**
 * Проверка мокапа «Оргструктура v2 — Обзор» (mockups/org-structure/org-structure-v2.html).
 * Playwright + system Chrome, файл открывается по file://. Растёт от задачи к задаче.
 * Запуск: node scripts/inspect/org-structure-v2-check.mjs
 */
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FILE = pathToFileURL(resolve('mockups/org-structure/org-structure-v2.html')).href;
const fails = [];
const ok = (name) => console.log('PASS  ' + name);
const check = (name, cond) => cond ? ok(name) : (fails.push(name), console.log('FAIL  ' + name));

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(FILE, { waitUntil: 'load' });

// --- Task 1: каркас вида «Обзор» ---
check('view-overview виден по умолчанию', await page.locator('#view-overview').isVisible());
check('crumb-title = «Оргструктура · Обзор»',
  (await page.locator('.crumb-title').innerText()).includes('Обзор'));
check('в nav есть пункт «Обзор»',
  await page.locator('.nav-item', { hasText: 'Обзор' }).count() === 1);
check('дерево подразделений НЕ показано на Обзоре',
  !(await page.locator('#view-units').isVisible()));

await ctx.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
process.exit(fails.length ? 1 : 0);
