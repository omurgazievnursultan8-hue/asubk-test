// Screenshot edited mockup tabs for visual verification after fixes.
import { chromium } from 'playwright-core';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { mkdirSync } from 'fs';
mkdirSync('.auth/loan-credit/mockfix',{recursive:true});
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, viewport:{width:1600,height:1000},
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
const url = pathToFileURL(resolve('mockups/loan-credit/loan-credit.html')).href;
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.click('#listBody tr:nth-child(10)');
await page.click('#btnEdit');
await page.waitForTimeout(300);
for (const t of [1,2,3,4,6,9,10]) {
  await page.evaluate(i => window.switchTab(i), t);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `.auth/loan-credit/mockfix/tab${t}.png` });
}
console.log('pageerrors:', errs.length? errs.join(' | '):'none');
await ctx.close();
