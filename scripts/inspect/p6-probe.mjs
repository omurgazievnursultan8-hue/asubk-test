// Phase 6 — Освоение и транши (disbursements + tranches). Route discovery probe.
// Logs in, dumps every nav menu item (text + route), filters to disbursement/tranche.
// Read-only. No data created or mutated.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

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
  await page.waitForTimeout(2500);
}

// expand all collapsible nav groups, then dump every link/item
await page.evaluate(() => {
  document.querySelectorAll('vaadin-details, vaadin-accordion-panel, [part~=summary]').forEach(d => {
    try { d.setAttribute('opened', ''); d.open = true; } catch {}
  });
});
await page.waitForTimeout(800);

const items = await page.evaluate(() => {
  const out = [];
  // anchors with hrefs
  document.querySelectorAll('a[href]').forEach(a => {
    const t = a.textContent.trim();
    if (t) out.push({ text: t, href: a.getAttribute('href') });
  });
  // vaadin side-nav / menu items
  document.querySelectorAll('vaadin-side-nav-item, vaadin-menu-bar-item, vaadin-tab').forEach(el => {
    const t = el.textContent.trim();
    const href = el.getAttribute('path') || el.getAttribute('href') || '';
    if (t) out.push({ text: t, href });
  });
  return out;
});

const re = /освоен|транш|disburse|tranche|drawdown/i;
const matches = items.filter(i => re.test(i.text) || re.test(i.href || ''));

writeFileSync('.auth/p6-probe.json', JSON.stringify({ allCount: items.length, matches, all: items }, null, 2));
console.log('total nav items:', items.length);
console.log('--- P6 matches ---');
for (const m of matches) console.log(`${m.text}  ->  ${m.href}`);
await ctx.close();
