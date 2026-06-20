// Phase 5 route discovery — find the loan-issuance (Выдача кредитов / Кредиты) route.
// Read-only: logs in, dumps sidebar nav links + their hrefs, no mutation.
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

// expand every collapsible nav group so all links render
const toggles = await page.$$('vaadin-side-nav-item, [part~=toggle-button], vaadin-details summary');
for (const t of toggles) { try { await t.click(); await page.waitForTimeout(150); } catch {} }
await page.waitForTimeout(800);

const nav = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a[href]')].map(a => ({
    text: a.textContent.trim().slice(0, 60),
    href: a.getAttribute('href'),
  })).filter(l => l.text);
  // anything mentioning loan/credit/issuance in RU or route
  const re = /кред|выдач|loan|credit|транш|освоен|залог/i;
  return {
    all: links,
    matches: links.filter(l => re.test(l.text) || re.test(l.href)),
  };
});

writeFileSync('.auth/loans-probe.json', JSON.stringify(nav, null, 2));
console.log('total links:', nav.all.length);
console.log('--- credit/loan matches ---');
for (const m of nav.matches) console.log(`${m.text}  ->  ${m.href}`);
await page.screenshot({ path: '.auth/loans-probe.png', fullPage: true });
await ctx.close();
