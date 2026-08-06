/**
 * Click into each tab of «Оргструктура» (Подразделения/Должности/Типы подразделений),
 * screenshot + dump DOM. Follow-up to orgstruct-explore.mjs.
 * Run: node scripts/inspect/orgstruct-tabs.mjs
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

await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

const tabs = [
  { name: 'Подразделения', shot: '.auth/org-structure-02-podrazdeleniya.png' },
  { name: 'Должности', shot: '.auth/org-structure-03-dolzhnosti.png' },
  { name: 'Типы подразделений', shot: '.auth/org-structure-04-tipy.png' },
];

for (const tab of tabs) {
  console.log('\n=== TAB:', tab.name, '===');
  const loc = page.locator('[role=tab]', { hasText: tab.name }).first();
  await loc.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: tab.shot, fullPage: true });

  const bodyText = await page.locator('body').innerText();
  console.log('--- BODY TEXT (first 3000 chars) ---');
  console.log(bodyText.slice(0, 3000));

  const gridCount = await page.locator('vaadin-grid').count();
  const treeCount = await page.locator('vaadin-grid-tree-toggle').count();
  console.log('vaadin-grid count:', gridCount, '| tree-toggle count:', treeCount);

  const buttons = (await page.locator('vaadin-button, button').allInnerTexts()).filter(Boolean);
  console.log('--- BUTTONS ---', JSON.stringify(buttons.slice(0, 40)));
}

await ctx.close();
