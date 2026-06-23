// scripts/inspect/tz/probe-app-general-tab.mjs
// Opens loan-applications/28 and reads the Общая информация tab carefully
// using a full-page text dump to capture ALL visible labels.
import { chromium } from 'playwright-core';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
  channel: 'chrome', headless: true, ignoreHTTPSErrors: true,
  viewport: { width: 1700, height: 2000 },
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

// Navigate directly to the known application
await page.goto(BASE + 'loan-applications/28', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
console.log('URL:', page.url());

// Scroll down to load all content
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1000);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);

// Full inner text of the page content area (after nav)
const pageText = await page.evaluate(() => {
  // Get just the main content area text
  const main = document.querySelector('main') || document.querySelector('#main') ||
    document.querySelector('.jmix-main-layout') || document.querySelector('[class*="main"]') ||
    document.body;
  return (main.innerText || '').replace(/\s{3,}/g, '\n\n').substring(0, 3000);
});
console.log('\n=== PAGE TEXT (Общая информация) ===');
console.log(pageText);

// Get ALL leaf text nodes with position (y,x) from the main content
const allTexts = await page.evaluate(() => {
  const results = [];
  function* walkAll(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let n = w.nextNode();
    while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
  }
  for (const el of walkAll(document)) {
    if (el.childElementCount > 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 5 || r.height < 5) continue;
    if (r.top < 100 || r.top > 1700) continue;
    const t = (el.innerText || el.textContent || '').trim().replace(/\s+/g,' ');
    if (!t || t.length < 2 || t.length > 150) continue;
    // Skip navigation items
    if (r.left < 250) continue;
    results.push({ t, y: Math.round(r.top), x: Math.round(r.left) });
  }
  return results.sort((a,b) => a.y - b.y || a.x - b.x);
});

// Remove duplicates
const seen = new Set();
const deduped = allTexts.filter(item => {
  const key = item.t + '|' + item.y;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log('\n=== ALL LEAF TEXTS (content area) ===');
deduped.forEach(item => console.log(`y=${item.y} x=${item.x}: ${item.t}`));

await page.screenshot({ path: '.auth/tz-la-28-general.png', fullPage: true });
await ctx.close();
