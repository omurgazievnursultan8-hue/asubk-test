// Phase 5 — capture the root of the loan-detail crash. Read-only.
// Opens a crashing record (id 20) and records console errors + failed network
// requests + the visible error dialog text. No mutation.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';
const ID = process.env.LOAN_ID || '20';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1600, height: 1000 },
});
const page = ctx.pages()[0] || await ctx.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('requestfailed', r => failedRequests.push(`${r.method()} ${r.url().slice(0, 120)} :: ${r.failure()?.errorText}`));
page.on('response', r => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 120)}`); });

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

// clear logs captured during login
consoleErrors.length = 0; failedRequests.length = 0;

await page.goto(BASE + 'loan-credits/' + ID, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2500);

// expand the "Подробности >>" details if present
try {
  const det = await page.evaluateHandle(() =>
    [...document.querySelectorAll('*')].find(e => /Подробности/.test(e.textContent) && e.childElementCount === 0));
  await det.asElement()?.click();
  await page.waitForTimeout(800);
} catch {}

const dialogText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 800));
await page.screenshot({ path: '.auth/loans-crash.png', fullPage: true });

const out = { id: ID, dialogText, consoleErrors, failedRequests };
writeFileSync('.auth/loans-crash.json', JSON.stringify(out, null, 2));
console.log('=== dialog text ===\n', dialogText);
console.log('=== console errors ===\n', consoleErrors.join('\n'));
console.log('=== failed/4xx-5xx requests ===\n', failedRequests.join('\n'));
await ctx.close();
