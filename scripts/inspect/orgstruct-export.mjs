/**
 * Precisely check Экспорт структуры / Паспорт на дату: listen for download events,
 * new pages, and console errors around the click.
 * Run: node scripts/inspect/orgstruct-export.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();

const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push('pageerror: ' + err.message));
ctx.on('page', p => console.log('NEW PAGE OPENED:', p.url()));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
    page.keyboard.press('Enter'),
  ]);
  await page.waitForTimeout(2000);
}

await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

console.log('=== click Экспорт структуры, race download vs 5s timeout ===');
consoleErrors.length = 0;
const dl1 = page.waitForEvent('download', { timeout: 5000 }).then(d => 'DOWNLOAD: ' + d.suggestedFilename()).catch(() => 'NO DOWNLOAD EVENT');
await page.locator('vaadin-button:visible', { hasText: 'Экспорт структуры' }).first().click();
console.log(await dl1);
console.log('console errors after Экспорт click:', JSON.stringify(consoleErrors));

console.log('\n=== click Паспорт на дату, race download vs 5s timeout ===');
consoleErrors.length = 0;
const dl2 = page.waitForEvent('download', { timeout: 5000 }).then(d => 'DOWNLOAD: ' + d.suggestedFilename()).catch(() => 'NO DOWNLOAD EVENT');
await page.locator('vaadin-button:visible', { hasText: 'Паспорт на дату' }).first().click();
console.log(await dl2);
console.log('console errors after Паспорт click:', JSON.stringify(consoleErrors));
console.log('page count:', ctx.pages().length);

await ctx.close();
