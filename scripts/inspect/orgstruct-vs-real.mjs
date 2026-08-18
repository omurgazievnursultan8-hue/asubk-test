/**
 * Full survey of the live «Оргструктура» module (/org-structure-mgmt) — 2026-08-18.
 * Purpose: compare shipped module surface + seeded data against the real ГФХ org chart
 * («Структура ОАО госфинхолдинг 01.10.2025.docx»).
 * Run: node scripts/inspect/orgstruct-vs-real.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';
const PROFILE = '.auth/profile';
const OUT = '.auth/orgstruct-2026-08-18';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1050 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const log = (...a) => console.log(...a);
const MAIN = 'vaadin-app-layout > vaadin-vertical-layout:not([slot])';
const mainText = async () => (await page.locator(MAIN).first().innerText().catch(() => '(no main)'));

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
log('URL after login:', page.url());

await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);
log('URL:', page.url(), '| TITLE:', await page.title());

const tabs = await page.locator('[role=tab]').allInnerTexts();
log('=== TOP TABS ===', JSON.stringify(tabs.map(t => t.trim()).filter(Boolean)));

// --- date-of-slice control(s) ---
const dateInputs = await page.locator('vaadin-date-picker input, input[type=date]').all();
for (const di of dateInputs) log('date input value:', JSON.stringify(await di.inputValue().catch(() => null)));

// ============ TAB: Обзор ============
await page.locator('[role=tab]', { hasText: 'Обзор' }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}-01-obzor.png`, fullPage: true });
log('\n=== ОБЗОР (body text) ===');
log(await mainText());

// ============ TAB: Подразделения ============
await page.locator('[role=tab]', { hasText: 'Подразделения' }).first().click().catch(() => {});
await page.waitForTimeout(1500);
for (let i = 0; i < 6; i++) {
  const toggles = page.locator('vaadin-grid-tree-toggle:visible');
  const n = await toggles.count();
  let clicked = 0;
  for (let j = 0; j < n; j++) {
    const expanded = await toggles.nth(j).getAttribute('expanded');
    if (expanded === null) { await toggles.nth(j).click().catch(() => {}); clicked++; await page.waitForTimeout(350); }
  }
  if (!clicked) break;
}
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}-02-tree.png`, fullPage: true });

const gridN = await page.locator('vaadin-grid').count();
log('\n=== ПОДРАЗДЕЛЕНИЯ === vaadin-grid count:', gridN);
for (let g = 0; g < gridN; g++) {
  const grid = page.locator('vaadin-grid').nth(g);
  const txt = await grid.locator('vaadin-grid-cell-content:visible').allInnerTexts().catch(() => []);
  log(`--- grid[${g}] cells (${txt.length}) ---`);
  log(JSON.stringify(txt.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)));
}
const btns = await page.locator('vaadin-button:visible, button:visible').allInnerTexts();
log('--- BUTTONS on Подразделения ---', JSON.stringify(btns.map(s => s.trim()).filter(Boolean)));

// open first unit card -> dump its 4 tabs
const firstRow = page.locator('vaadin-grid-cell-content:visible').nth(0);
await firstRow.click().catch(() => {});
await page.waitForTimeout(1200);
const cardTabs = await page.locator('[role=tab]').allInnerTexts();
log('--- TABS after selecting a unit ---', JSON.stringify(cardTabs.map(t => t.trim()).filter(Boolean)));
await page.screenshot({ path: `${OUT}-03-unit-card.png`, fullPage: true });
log('--- UNIT CARD text ---');
log(await mainText());

// ============ TAB: Должности ============
await page.locator('[role=tab]', { hasText: 'Должности' }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}-04-dolzhnosti.png`, fullPage: true });
log('\n=== ДОЛЖНОСТИ ===');
log(await mainText());

// ============ TAB: Типы подразделений ============
const typeTab = page.locator('[role=tab]', { hasText: 'Типы' }).first();
if (await typeTab.count()) {
  await typeTab.click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}-05-tipy.png`, fullPage: true });
  log('\n=== ТИПЫ ПОДРАЗДЕЛЕНИЙ ===');
  log(await mainText());
}

// ============ sidebar: what else exists (Сотрудники? Ведомство?) ============
log('\n=== SIDEBAR NAV ===');
const nav = await page.locator('section[slot=drawer] li').allInnerTexts().catch(() => []);
log(JSON.stringify(nav.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0,5)));

await ctx.close();
