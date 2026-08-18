/**
 * Authoritative per-unit facts: download «Экспорт структуры» CSV, re-check P11-01
 * liquidation gate on the childless leaf, and read each unit card's detail panel cleanly.
 * Run: node scripts/inspect/orgstruct-facts-2026-08-18.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const MAIN = 'vaadin-app-layout > vaadin-vertical-layout:not([slot])';
const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true, acceptDownloads: true,
  viewport: { width: 1680, height: 1050 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

// ---- CSV export ----
const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
await page.locator('vaadin-button, button').filter({ hasText: 'Экспорт структуры' }).first().click();
const d = await dl;
if (d) {
  const p = '.auth/orgstruct-2026-08-18.csv';
  await d.saveAs(p);
  console.log('CSV saved:', p, 'suggested:', d.suggestedFilename());
  console.log('----- CSV -----');
  console.log(fs.readFileSync(p, 'utf8'));
} else console.log('!! no download event for Экспорт структуры');

// ---- unit cards, clean detail panel ----
await page.locator('[role=tab]', { hasText: 'Подразделения' }).first().click();
await page.waitForTimeout(1500);
for (let i = 0; i < 5; i++) {
  const t = page.locator('vaadin-grid-tree-toggle:visible');
  const n = await t.count(); let c = 0;
  for (let j = 0; j < n; j++) if (await t.nth(j).getAttribute('expanded') === null) { await t.nth(j).click().catch(() => {}); c++; await page.waitForTimeout(300); }
  if (!c) break;
}
const rowTexts = await page.evaluate(() =>
  [...document.querySelectorAll('vaadin-grid-tree-toggle')].map(t => (t.textContent || '').replace(/\s+/g, ' ').trim()));
console.log('\n----- rows -----', JSON.stringify(rowTexts));

for (let i = 0; i < rowTexts.length; i++) {
  await page.evaluate(idx => {
    const t = [...document.querySelectorAll('vaadin-grid-tree-toggle')][idx];
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  }, i);
  await page.waitForTimeout(1000);
  const detail = await page.evaluate(() => {
    // right-hand panel: the layout that contains the unit-card tabs
    const tabsets = [...document.querySelectorAll('vaadin-tabs, vaadin-tabsheet')];
    const card = tabsets[tabsets.length - 1];
    let n = card; for (let k = 0; k < 4 && n && n.parentElement; k++) n = n.parentElement;
    return (n?.innerText || '').replace(/\n+/g, ' | ');
  });
  console.log(`\n### ${rowTexts[i]}\n    ${detail.slice(0, 900)}`);
}

// ---- P11-01: liquidation gate on childless leaf ----
console.log('\n########## P11-01 re-check: Закрытие on «Отдел бухгалтерского учёта» ##########');
const leafIdx = rowTexts.findIndex(t => t.includes('бухгалтерского'));
if (leafIdx >= 0) {
  await page.evaluate(idx => {
    const t = [...document.querySelectorAll('vaadin-grid-tree-toggle')][idx];
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  }, leafIdx);
  await page.waitForTimeout(1200);
  await page.locator('[role=tab]', { hasText: 'Закрытие' }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  console.log((await page.locator(MAIN).first().innerText()).split('Закрытие').pop().slice(0, 1200));
  await page.screenshot({ path: '.auth/orgstruct-2026-08-18-zakrytie.png', fullPage: true });
}

// ---- role control? ----
console.log('\n########## role control ##########');
const roleCtl = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('vaadin-select, vaadin-combo-box, vaadin-radio-group').forEach(e =>
    out.push(e.tagName + ' :: ' + (e.getAttribute('label') || '') + ' :: ' + (e.innerText || '').replace(/\s+/g, ' ').slice(0, 80)));
  return out;
});
console.log(JSON.stringify(roleCtl, null, 1));

await ctx.close();
