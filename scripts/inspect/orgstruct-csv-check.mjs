/**
 * Save the Экспорт структуры CSV and inspect its raw bytes/header vs P11-R13 spec
 * (separator ';', UTF-8 BOM, columns Подразделение·Тип·Вышестоящее·Руководитель на
 * дату·Ставок по штату·Занято·Территория).
 * Run: node scripts/inspect/orgstruct-csv-check.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
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
  await page.waitForTimeout(2000);
}
await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

const dl = page.waitForEvent('download');
await page.locator('vaadin-button:visible', { hasText: 'Экспорт структуры' }).first().click();
const download = await dl;
const savePath = '.auth/exported.csv';
await download.saveAs(savePath);
const buf = fs.readFileSync(savePath);
console.log('bytes length:', buf.length);
console.log('first 8 bytes hex:', buf.slice(0, 8).toString('hex'));
console.log('has UTF8 BOM (efbbbf):', buf.slice(0,3).toString('hex') === 'efbbbf');
console.log('first 400 chars:', buf.toString('utf8').slice(0, 400));

await ctx.close();
