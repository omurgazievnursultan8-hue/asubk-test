// scripts/inspect/tz/nav-spravochniki.mjs
// Enumerate the left-nav "Справочники" group: every dictionary menu item + its route.
// Output: JSON { groups[], spravochniki[{label, route}] } to stdout + .auth/nav-spravochniki.json
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const BASE = 'https://fkftest.okmot.kg/';
const USER = process.env.OK_USER || 'admin';
const PASS = process.env.OK_PASS || 'admin';

const ctx = await chromium.launchPersistentContext('.auth/profile', {
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
await page.waitForTimeout(1500);

// Dump every nav item (label, href, depth) piercing shadow DOM. Jmix uses
// vaadin-side-nav / jmix-list-menu with nested <vaadin-side-nav-item> or <a>.
function navDump() {
  return page.evaluate(() => {
    function* walkAll(root) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let n = w.nextNode();
      while (n) { yield n; if (n.shadowRoot) yield* walkAll(n.shadowRoot); n = w.nextNode(); }
    }
    const items = [];
    for (const el of walkAll(document)) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'vaadin-side-nav-item' || tag === 'a' ||
          el.classList?.contains('jmix-list-menu-item') ||
          tag === 'vaadin-details' || el.getAttribute?.('role') === 'menuitem') {
        const label = (el.getAttribute('aria-label') ||
          el.querySelector?.('[slot=label]')?.textContent ||
          el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        const href = el.getAttribute?.('path') || el.getAttribute?.('href') || '';
        if (label) items.push({ tag, label, href });
      }
    }
    return items;
  });
}

// Try to expand all collapsible nav groups so children render.
async function expandAll() {
  for (let pass = 0; pass < 4; pass++) {
    const toggles = await page.$$('vaadin-side-nav-item, summary, vaadin-details > [slot=summary], .jmix-list-menu-item');
    for (const t of toggles) {
      try { if (await t.isVisible()) { await t.click({ timeout: 600 }).catch(() => {}); } } catch {}
    }
    await page.waitForTimeout(400);
  }
}

await expandAll();
const all = await navDump();
// Deduplicate by label+href
const seen = new Set();
const items = all.filter(i => { const k = i.label + '|' + i.href; if (seen.has(k)) return false; seen.add(k); return true; });

writeFileSync('.auth/nav-spravochniki.json', JSON.stringify(items, null, 1));
console.log('total nav items:', items.length);
console.log(JSON.stringify(items.filter(i => i.href), null, 1));
await page.screenshot({ path: '.auth/nav-spravochniki.png', fullPage: true });
await ctx.close();
