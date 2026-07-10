// Проверка to-be мокапа взыскания (mockups/collection/collection.html).
// Спек: docs/superpowers/specs/2026-07-10-collection-mockup-design.md
// Запуск: node scripts/inspect/collection-check.mjs
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const FILE = pathToFileURL(resolve('mockups/collection/collection.html')).href;
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(FILE, { waitUntil: 'load' });

let fails = 0;
const ok = (name, cond) => { if (!cond) fails++; console.log(`${cond ? '  ok' : 'FAIL'}  ${name}`); };

// --- T1: список ---
ok('4 процесса в гриде', (await page.locator('#listBody tr').count()) === 4);
ok('№ процесса структурный', (await page.locator('#listBody tr[data-id="142"] td').first().innerText()) === 'В-2026-000142');
ok('«Открыть процесс» заблокирована до выбора', await page.locator('#btnOpen').isDisabled());
await page.click('#listBody tr[data-id="142"]');
ok('после выбора строки кнопка активна', !(await page.locator('#btnOpen').isDisabled()));
await page.click('#btnOpen');
ok('7 вкладок', (await page.locator('#detailTabbar .dtab').count()) === 7);
ok('хлебная крошка с номером', (await page.locator('#crumbTitle').innerText()).includes('В-2026-000142'));

console.log(`\nОШИБОК КОНСОЛИ: ${errors.length}`);
errors.forEach(e => console.log('  ' + e));
console.log(`ПРОВАЛЕНО АССЕРТОВ: ${fails}`);
await ctx.close();
process.exit(fails || errors.length ? 1 : 0);
