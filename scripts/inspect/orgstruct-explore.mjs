/**
 * Explore live «Оргструктура» module (org-structure-mgmt), report claimed done by devs.
 * Playwright + system Chrome. Login + navigate + dump structure/screenshot per view.
 * Run: node scripts/inspect/orgstruct-explore.mjs
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
console.log('URL after login:', page.url());

await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);
console.log('URL:', page.url());
console.log('TITLE:', await page.title());

await page.screenshot({ path: '.auth/org-structure-01-initial.png', fullPage: true });

// dump visible text to understand layout
const bodyText = await page.locator('body').innerText();
console.log('--- BODY TEXT (first 4000 chars) ---');
console.log(bodyText.slice(0, 4000));

// look for tabs / nav structures typical of Vaadin
const tabCandidates = await page.locator('vaadin-tabs, vaadin-tab, [role=tab]').allInnerTexts();
console.log('--- TAB CANDIDATES ---', JSON.stringify(tabCandidates));

const gridCount = await page.locator('vaadin-grid').count();
console.log('vaadin-grid count:', gridCount);

const treeGridCount = await page.locator('vaadin-grid-tree-toggle').count();
console.log('tree-toggle count:', treeGridCount);

const buttons = await page.locator('vaadin-button, button').allInnerTexts();
console.log('--- BUTTONS ---', JSON.stringify(buttons.filter(Boolean).slice(0, 60)));

await ctx.close();
