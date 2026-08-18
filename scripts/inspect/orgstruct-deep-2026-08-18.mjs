/**
 * Deep dump: Обзор KPI in full, unit tree with levels + per-unit card facts,
 * and the competing flat dictionaries (Отделы / Должности / Сотрудники) in the sidebar.
 * Run: node scripts/inspect/orgstruct-deep-2026-08-18.mjs
 */
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const PROFILE = '.auth/profile';
const MAIN = 'vaadin-app-layout > vaadin-vertical-layout:not([slot])';

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1680, height: 1050 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
if (page.url().includes('/login')) {
  await page.fill('input[name=username]', process.env.OK_USER || 'admin');
  await page.fill('input[name=password]', process.env.OK_PASS || 'admin');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}), page.keyboard.press('Enter')]);
  await page.waitForTimeout(2500);
}
const main = () => page.locator(MAIN).first();

await page.goto(BASE + 'org-structure-mgmt', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

console.log('########## ОБЗОР (full) ##########');
console.log(await main().innerText());

console.log('\n########## ПОДРАЗДЕЛЕНИЯ: tree with levels ##########');
await page.locator('[role=tab]', { hasText: 'Подразделения' }).first().click();
await page.waitForTimeout(1500);
for (let i = 0; i < 6; i++) {
  const t = page.locator('vaadin-grid-tree-toggle:visible');
  const n = await t.count(); let clicked = 0;
  for (let j = 0; j < n; j++) {
    if (await t.nth(j).getAttribute('expanded') === null) { await t.nth(j).click().catch(() => {}); clicked++; await page.waitForTimeout(300); }
  }
  if (!clicked) break;
}
await page.waitForTimeout(700);
const tree = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('vaadin-grid-tree-toggle').forEach(t => {
    const lvl = t.getAttribute('level');
    out.push({ level: lvl, leaf: t.hasAttribute('leaf'), expanded: t.hasAttribute('expanded'), text: (t.textContent || '').replace(/\s+/g, ' ').trim() });
  });
  return out;
});
tree.forEach(r => console.log(`  ${'  '.repeat(Number(r.level || 0))}[L${r.level}${r.leaf ? ' leaf' : ''}] ${r.text}`));

console.log('\n########## per-unit card facts ##########');
const names = tree.map(r => r.text).filter(Boolean);
for (const nm of names) {
  const cell = page.locator('vaadin-grid-cell-content', { hasText: new RegExp('^' + nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*⚠?$') }).first();
  await cell.click().catch(() => {});
  await page.waitForTimeout(900);
  const txt = await main().innerText();
  const card = txt.split(nm).pop() || '';
  const facts = card.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 26);
  console.log(`--- ${nm} ---`);
  console.log(facts.join(' | '));
  // Штатное расписание tab
  const st = page.locator('[role=tab]', { hasText: 'Штатное расписание' }).first();
  if (await st.count()) {
    await st.click().catch(() => {});
    await page.waitForTimeout(800);
    const t2 = await main().innerText();
    console.log('    ШТАТ: ' + (t2.split('Штатное расписание').pop() || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20).join(' | '));
    await page.locator('[role=tab]', { hasText: 'Обзор' }).nth(1).click().catch(() => {});
    await page.waitForTimeout(400);
  }
}
await page.screenshot({ path: '.auth/orgstruct-2026-08-18-deep-tree.png', fullPage: true });

console.log('\n########## competing flat dictionaries ##########');
const links = await page.evaluate(() => {
  const wanted = ['Отделы', 'Должности', 'Сотрудники', 'Отделы для заключений', 'Информация о сотрудниках', 'Информация о ведомстве'];
  const out = [];
  document.querySelectorAll('section[slot=drawer] a').forEach(a => {
    const t = (a.textContent || '').trim();
    if (wanted.includes(t)) out.push({ text: t, href: a.getAttribute('href') });
  });
  return out;
});
console.log(JSON.stringify(links, null, 1));

for (const l of links) {
  if (!l.href) continue;
  await page.goto(new URL(l.href, BASE).href, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log(`\n=== ${l.text} (${l.href}) ===`);
  console.log((await main().innerText()).slice(0, 2200));
}
await ctx.close();
